# PIDController

## Overview

`PIDController` is the central state-coordination contract of the BankX protocol. It is responsible for adjusting the global collateral ratio, tracking AMM pool prices via a rolling 10-slot average, managing the three deficit buckets, computing `neededWETH` and `neededBankX` for mint/redeem calculations, and enforcing the block-delay anti-flash-loan mechanism across all user-facing contracts.

---

## Key Concepts

- **`global_collateral_ratio`** — Shared ratio (`1e6` precision) read by `CollateralPool` for all mint/redeem operations. Starts at `1000000` (100%) at deployment.
- **`xsd_step`** — CR change increment per `systemCalculations()` call. Default: `2500` (0.25%).
- **Rolling price average** — 10-slot circular buffer (`xsdPriceHistory`, `bankxPriceHistory`). Updated every `priceUpdateInterval` seconds (default: 180 seconds). Spot prices are derived from AMM pool reserves and the Chainlink ETH/USD feed.
- **`neededWETH` / `neededBankX`** — WETH and BankX amounts (in 1e6 precision of dollars per XSD unit) required to mint 1 XSD at the current CR. Updated by `priceCheck()`.
- **`interest_rate`** — Annual interest rate for minters. Computed as `max((1e6 - CR) / 2, 52800)`. Updated with every CR change.
- **Three deficit buckets** — `bucket1` (XSD/WETH pool), `bucket2` (BankX/WETH pool), `bucket3` (CollateralPool). Each tracks `diff`, `timestamp`, and `amountpaid`.
- **`lastPriceCheck`** — Per-address mapping used to enforce the block-delay. Set by `priceCheck()`, cleared by `setPriceCheck()` after each gated action.

---

## Architecture

```
PIDController
├── Inherits: Initializable
├── Reads: XSDStablecoin.eth_usd_price(), xag_usd_price(), totalSupply()
├── Reads: IXSDWETHpool.getReserves()
├── Reads: IBankXWETHpool.getReserves()
├── Reads: ICollateralPool.collat_XSD(), collatDollarBalance()
├── Reads: ICD.allocatedSupply()           (bucket2)
├── Calls: BankXNFTInterface.updateTVLReached() (every 12 hours)
├── Called by: CollateralPool, Router, RewardManager
│             (setPriceCheck, lastPriceCheck, neededWETH/BankX, bucket flags)
└── Admin: Owner only
```

---

## State Variables (Selected)

| Variable | Type | Default | Description |
|---|---|---|---|
| `global_collateral_ratio` | `uint256` | `1000000` | CR in 1e6 precision |
| `xsd_step` | `uint256` | `2500` | CR adjustment step (0.25%) |
| `interest_rate` | `uint256` | `52800` | Annual minter interest rate (1e6 precision) |
| `price_band` | `uint256` | `5000` | Deadband around peg; CR unchanged if price within ±0.5% |
| `GR_top_band` / `GR_bottom_band` | `uint256` | `1000` each | Growth ratio tolerance bands |
| `priceUpdateInterval` | `uint256` | `180` | Seconds between rolling price buffer updates |
| `PRICE_HISTORY_LENGTH` | `uint256` | `10` (constant) | Number of slots in rolling price buffer |
| `bucket1/2/3` | `bool` | `false` | Active deficit flags |
| `diff1/2/3` | `uint` | `0` | Deficit magnitude (in USD, 1e18) |
| `timestamp1/2/3` | `uint` | `0` | When bucket was opened |
| `amountpaid1/2/3` | `uint` | `0` | USD value filled so far |
| `neededWETH` | `uint256` | — | WETH (in 1e6 dollar units) to mint 1 XSD |
| `neededBankX` | `uint256` | — | BankX (in 1e6 dollar units) to mint 1 XSD |
| `bankx_updated_price` | `uint256` | — | Rolling-average BankX price (1e6 USD) |
| `xsd_updated_price` | `uint256` | — | Rolling-average XSD price (1e6 USD) |
| `is_active` | `bool` | `true` | Enables CR updates in `systemCalculations()` |
| `use_growth_ratio` | `bool` | `false` | Enables growth-ratio-based CR adjustment |
| `collateral_ratio_paused` | `bool` | `false` | Freezes CR updates |
| `FIP_6` | `bool` | `false` | Restricts `systemCalculations()` to out-of-peg conditions |
| `pool_precision` | `uint256` | `1000000` | AMM reserve price precision |

---

## Core Functions

### Public Mutative

| Function | Access | Modifiers | Description |
|---|---|---|---|
| `systemCalculations()` | `public` | None | Main CR update function. Reads prices, adjusts CR, updates interest rate, checks deficit buckets. Subject to `collateral_ratio_cooldown`. |
| `priceCheck()` | `public` | `timeDelay(price_last_update)` | Updates `neededWETH`, `neededBankX`, `xsd_updated_price`, `bankx_updated_price`. Records the caller's `lastPriceCheck`. Required before any `blockDelay`-gated action. |
| `updatePrices()` | `public` | None | Updates rolling price buffer if `priceUpdateInterval` has elapsed. |
| `setPriceCheck(address sender)` | `public` | `zeroCheck` | Resets `lastPriceCheck[sender].pricecheck = false`. Called by CollateralPool and Router after each gated action. |

### Views

| Function | Mutability | Description |
|---|---|---|
| `xsd_price()` | `view` | Returns `xsd_updated_price` (rolling average). |
| `bankx_price()` | `view` | Returns `bankx_updated_price` (rolling average). |

### Reward Manager (onlyByRewardManager)

| Function | Description |
|---|---|
| `amountPaidXSDWETH(uint ethvalue)` | Increments `amountpaid1` (bucket1 fill progress). |
| `amountPaidBankXWETH(uint ethvalue)` | Increments `amountpaid2`. |
| `amountPaidCollateralPool(uint ethvalue)` | Increments `amountpaid3`. |

### Admin (onlyByOwner)

| Function | Description |
|---|---|
| `activate(bool _state)` | Enables/disables CR updates. |
| `useGrowthRatio(bool)` | Enables growth-ratio-based CR direction. |
| `setGrowthRatioBands(uint256, uint256)` | Sets `GR_top_band` and `GR_bottom_band`. |
| `setInternalCooldown(uint256)` | Sets `internal_cooldown` for `priceCheck()`. |
| `setPriceBandPercentage(uint256)` | Sets `xsd_percent` (peg tolerance %). |
| `toggleCollateralRatio(bool)` | Pauses/unpauses CR updates. |
| `activateFIP6(bool)` | Enables/disables FIP-6 mode. |
| `setPriceTarget(uint256)` | Sets the price target used for final CR update. |
| `setXSDStep(uint256)` | Changes CR step size. |
| `setPoolPrecision(uint256)` | Changes AMM price precision multiplier. |
| `setPriceBand(uint256)` | Changes the deadband around the price target. |
| `setInterestRate(uint256)` | Overrides the computed interest rate. |
| `setRatioCooldown(uint256)` | Sets `collateral_ratio_cooldown` (minimum seconds between CR updates). |
| `setPriceUpdateInterval(uint256)` | Sets `priceUpdateInterval` in seconds. |

---

## Events

| Event | Parameters | When Emitted |
|---|---|---|
| `PIDCollateralRatioRefreshed(uint256)` | New CR | After every successful CR update |
| `XSDdecollateralize(uint256)` | New CR | When CR is decreased |
| `XSDrecollateralize(uint256)` | New CR | When CR is increased |
| `PriceTargetSet(uint256)` | New target | `setPriceTarget()` |
| `XSDStepSet(uint256)` | New step | `setXSDStep()` |
| `InternalPriceTargetSet(uint256)` | Internal target | During `systemCalculations()` |
| `InternalXSDStepSet(uint256)` | Internal step | During `systemCalculations()` |

---

## Price Calculation

Pool prices are derived from AMM reserves using the ETH/USD Chainlink price:

```solidity
function pool_price(PriceChoice choice) internal view returns (uint256) {
    // reserveA = token (XSD or BankX), reserveB = WETH
    uint256 price_vs_eth = (reserveA * pool_precision) / reserveB;
    uint256 price = (eth_usd_price * pool_precision) / price_vs_eth;
    return price; // 1e6 USD precision
}
```

These spot prices are stored in the 10-slot circular buffer and the arithmetic mean is used as `xsd_updated_price` / `bankx_updated_price`.

---

## Deficit Bucket Thresholds

| Bucket | Condition | Duration | Effect on Protocol |
|---|---|---|---|
| `bucket1` | XSD/WETH AMM WETH depth < `xsd_percentage_target`% of XSD market cap | 18 hours max | Enables liquidity rewards for XSD/WETH |
| `bucket2` | BankX/WETH AMM WETH depth < `bankx_percentage_target`% of BankX CD supply | 18 hours max | Enables liquidity rewards for BankX/WETH |
| `bucket3` | `collatValue * 400 <= 3 * XSDvalue` (≈ CR < 75%) | 7 days max | Blocks all redemptions; enables collateral pool rewards |

---
