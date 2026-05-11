# Router

## Overview

`Router` is the primary user-facing entry point for swaps and liquidity operations. It wraps the XSD/WETH and BankX/WETH AMM pools, routes ETH through the WETH contract, enforces circuit breakers (price deviation, per-token volume, global volume), and delegates liquidity reward accounting to the `RewardManager`. All swap functions require the caller to have a valid `priceCheck` in the PID Controller (block-delay mechanism).

---

## Key Concepts

- **Circuit breakers.** Two tiers of safety checks run on every swap:
  1. **Per-token price deviation.** The pool spot price must not deviate more than `price_threshold[token_type]` basis points from the PID rolling-average price.
  2. **Per-token volume.** The WETH volume of a single swap must not exceed `volume_threshold[token_type]` ETH.
  3. **Global volume.** Total protocol swap volume (ETH-equivalent) per `timeInterval` window (default: 5 minutes) must not exceed `globalVolumeThreshold` (default: 1000 ETH).
- **`minSwapAmountUSD`** — Minimum swap size in USD (18-decimal). Default: `10 * 10**18` ($10). Protects against dust transactions.
- **Deflationary burn on sell.** When a user sells XSD or BankX for ETH, 10% of the input token amount is burned from the AMM pool if conditions are met.
- **`blockDelay` modifier.** Same block-delay mechanism as `CollateralPool`: requires a recent `priceCheck` in the PID Controller and resets it after each swap.
- **`swap_paused` / `liquidity_paused`** — Owner-toggleable pause flags for swaps and liquidity separately.

---

## Architecture

```
Router
├── Inherits: IRouter, Initializable, ReentrancyGuard
├── Calls: IXSDWETHpool.swap()
│         IBankXWETHpool.swap()
├── Calls: IWETH.deposit(), withdraw()
├── Calls: IRewardManager.creatorProvide*, userProvide*, LiquidityRedemption()
├── Calls: XSDStablecoin.burnpoolXSD()   (XSD deflationary burn)
│         BankXToken.burnpoolBankX()     (BankX deflationary burn)
├── Reads: IPIDController.xsd_updated_price(), bankx_updated_price()
│         IPIDController.lastPriceCheck(), bucket1()
├── Calls: IPIDController.setPriceCheck()
└── Math: BankXLibrary.quote()
```

---

## State Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `WETH` | `address` | — | WETH contract address |
| `XSDWETH_pool_address` | `address` | — | XSD/WETH AMM pool |
| `BankXWETH_pool_address` | `address` | — | BankX/WETH AMM pool |
| `collateral_pool_address` | `address` | — | CollateralPool address |
| `reward_manager_address` | `address` | — | RewardManager address |
| `bankx_address` | `address` | — | BankX token |
| `xsd_address` | `address` | — | XSD token |
| `treasury` | `address` | — | Treasury; authorised for creator liquidity |
| `smartcontract_owner` | `address` | — | Protocol owner |
| `block_delay` | `uint` | Set at init | Blocks between price check and gated action |
| `swap_paused` | `bool` | `false` | Toggle for all swaps |
| `liquidity_paused` | `bool` | `false` | Toggle for user liquidity addition |
| `minSwapAmountUSD` | `uint256` | `10e18` | Min swap value in USD (18 decimals) |
| `pool_precision` | `uint256` | `1000000` | Constant for AMM price math |
| `price_threshold[token_type]` | `mapping(uint8 => uint256)` | `1000` | Max allowed deviation in basis points (10%) |
| `volume_threshold[token_type]` | `mapping(uint8 => uint256)` | `1000 ether` | Max single-swap volume in ETH |
| `xsd_breaker.last_price` | `uint256` | Init price | Last XSD price recorded during a swap |
| `bankx_breaker.last_price` | `uint256` | Init price | Last BankX price recorded during a swap |
| `timeInterval` | `uint256` | `300` | Global volume window (seconds) |
| `globalVolumeThreshold` | `uint256` | `1000 ether` | Max ETH volume per time interval |

---

## Core Functions

### Swaps (nonReentrant, swapPaused, blockDelay, ensure)

| Function | Input | Output | Description |
|---|---|---|---|
| `swapETHForXSD(uint amountOut, uint deadline)` | ETH (msg.value) | XSD | Swaps ETH for XSD via XSD/WETH pool. |
| `swapXSDForETH(uint amountOut, uint amountInMax, uint deadline)` | XSD | ETH | Swaps XSD for ETH. Burns 10% of input from the AMM pool (if conditions met). |
| `swapETHForBankX(uint amountOut, uint deadline)` | ETH (msg.value) | BankX | Swaps ETH for BankX via BankX/WETH pool. |
| `swapBankXForETH(uint amountOut, uint amountInMax, uint deadline)` | BankX | ETH | Swaps BankX for ETH. Burns 10% of input if `totalSupply > genesis_supply`. |

All swap functions:
1. Validate minimum USD value of input.
2. Compute expected output using `BankXLibrary.quote()` (constant-product formula).
3. Run `checkAndUpdateSafety()` (price deviation + volume checks).
4. Transfer WETH to the pool and call `pool.swap()`.

### Liquidity (ensure)

| Function | Access | Description |
|---|---|---|
| `creatorAddLiquidityTokens(address tokenB, uint amountB, uint deadline)` | Treasury or owner | Transfers XSD or BankX to the appropriate pool; triggers creator reward accounting. |
| `creatorAddLiquidityETH(address pool, uint256 deadline)` | Treasury or owner | Wraps ETH to WETH, sends to pool, triggers creator accounting. |
| `userAddLiquidityETH(address pool, uint deadline)` | Any user | Wraps ETH, sends to pool, triggers user reward accounting via RewardManager. Requires `!liquidity_paused`. |
| `userRedeemLiquidity(address pool, uint deadline)` | Any user | Calls `RewardManager.LiquidityRedemption()` for the specified pool. |

### Admin (onlyByOwner)

| Function | Description |
|---|---|
| `pauseSwaps()` | Toggles `swap_paused`. |
| `pauseLiquidity()` | Toggles `liquidity_paused`. |
| `setMinSwapAmountUSD(uint256)` | Updates minimum swap threshold. |
| `setSafetyThresholds(uint8, uint256, uint256)` | Sets price and volume thresholds per token type (0=XSD, 1=BankX). |
| `setTimeInterval(uint256)` | Sets global volume window duration. |
| `setVolumeThreshold(uint256)` | Sets global volume cap per interval. |
| `resetGlobalVolume()` | Resets current interval's volume counter. |
| `setSmartContractOwner(address)` | Transfers ownership. |
| `renounceOwnership()` | Irreversible ownership renouncement. |
| `setBankXAddress/setXSDAddress/setXSDPoolAddress/...` | Individual address setters. |

---

## Events

| Event | Parameters | When Emitted |
|---|---|---|
| `RouterInitialized(...)` | All init addresses and block_delay | `initialize()` |
| `MinSwapAmountUSDUpdated(uint256, uint256)` | old, new | `setMinSwapAmountUSD()` |
| `GlobalVolumeThresholdExceeded(uint256, uint256, uint256)` | volume, threshold, resumeTime | Circuit breaker trigger |
| `GlobalVolumeReset(uint256, address)` | timestamp, admin | `resetGlobalVolume()` |
| `GlobalVolumeConfigChanged(string, uint256, uint256)` | parameter, old, new | Interval/threshold setters |

---

## Deflationary Burn Logic

**XSD sell:** After the swap, if uncollateralised XSD supply `(totalSupply - collat_XSD) > amountInMax / 10` and `bucket1 == false`:
```solidity
XSD.burnpoolXSD(amountInMax / 10);
```
10% of the XSD input is burned from the XSD/WETH pool, reducing circulating supply.

**BankX sell:** If `totalSupply - amountInMax/10 > genesis_supply`:
```solidity
BankXToken(bankx_address).burnpoolBankX(amountInMax / 10);
```
10% of BankX input is burned from the BankX/WETH pool, only when BankX is still above genesis supply after the burn.

---

## Security Considerations

- **Circuit breakers revert, not halt.** If any safety threshold is exceeded, the entire transaction reverts. There is no partial execution.
- **`blockDelay` on all swaps.** Users must call `pid_controller.priceCheck()` before every swap. Flash loans cannot mint XSD, swap, and redeem in a single transaction.
- **Minimum swap size.** `minSwapAmountUSD` prevents economic griefing through dust swaps that could incrementally manipulate the rolling price buffer.
- **`receive()` restricted to WETH.** Rejects direct ETH sends from non-WETH addresses.
