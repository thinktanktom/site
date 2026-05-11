# RewardManager

## Overview

`RewardManager` coordinates the protocol's liquidity incentive system. When the PID Controller signals a deficit (bucket1, bucket2, or bucket3), the `RewardManager` allows users to provide liquidity to the deficient pool and earn tiered BankX and XSD rewards that vest over time. The contract also exposes entry points for the treasury/owner to provide liquidity without earning rewards (creator functions).

---

## Key Concepts

- **Three vesting tiers.** Each deficit is divided into three equal thirds. Tier 1 fills the first third (shortest vesting), Tier 2 fills the second third, Tier 3 fills the final third (longest vesting).
- **`Liquidity_Provider` struct.** Stores per-address, per-pool, per-vesting-tier state: `vestingtimestamp`, `ethvalue` (USD contributed), `xsdrewards` (USD-denominated), `bankxrewards` (USD-denominated).
- **Rewards denominated in USD.** Stored reward amounts are denominated in ETH value (USD equivalent). At redemption they are converted to BankX/XSD token amounts using the current PID Controller prices.
- **`block_delay` modifier.** User liquidity provision (BankX and XSD pools) requires a valid `priceCheck` in the PID Controller (same anti-flash-loan mechanism as CollateralPool).
- **`lock` modifier.** A UniswapV2-style mutex prevents reentrancy within reward manager calls.
- **Collateral pool provision has no `blockDelay`.** The urgency of a `bucket3` event means users can provide collateral immediately without the `priceCheck` prerequisite.

---

## Architecture

```
RewardManager
├── Inherits: IRewardManager, Initializable
├── Reads: IPIDController.bucket1/2/3(), diff1/2/3(), amountpaid1/2/3()
│         IPIDController.bankx_updated_price(), xsd_updated_price()
│         XSDStablecoin.eth_usd_price()
├── Calls: IPIDController.amountPaidXSDWETH/BankXWETH/CollateralPool()
│         IPIDController.setPriceCheck()
├── Calls: BankXToken.pool_mint()       (rewards)
│         XSDStablecoin.pool_mint()     (rewards)
├── Calls: IXSDWETHpool.sync(), IBankXWETHpool.sync()
└── Called by: Router (userAddLiquidityETH, creatorAddLiquidity*, userRedeemLiquidity)
```

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `smartcontract_owner` | `address` | Contract owner |
| `bankx_pool_address` | `address` | BankX/WETH pool address |
| `xsd_pool_address` | `address` | XSD/WETH pool address |
| `collat_pool_address` | `address` | CollateralPool address |
| `xsd_address` | `address` | XSD token address |
| `bankx_address` | `address` | BankX token address |
| `weth_address` | `address` | WETH token address |
| `vesting1` | `uint` | Tier 1 vesting duration (seconds) |
| `vesting2` | `uint` | Tier 2 vesting duration (seconds) |
| `vesting3` | `uint` | Tier 3 vesting duration (seconds) |
| `block_delay` | `uint` | Blocks required between price check and liquidity provision |
| `liquidity_provider` | `mapping(address => mapping(address => mapping(uint => Liquidity_Provider)))` | `[pool][user][vesting_tier]` → reward state |

---

## Core Functions

### Creator (Treasury / Owner)

| Function | Access | Description |
|---|---|---|
| `creatorProvideXSDLiquidity()` | `external` (treasury/owner only via Router) | Syncs XSD/WETH pool reserves; updates `amountpaid1` if `bucket1` active. |
| `creatorProvideBankXLiquidity()` | `external` | Syncs BankX/WETH pool reserves; updates `amountpaid2` if `bucket2` active. |

These are called by the Router's `creatorAddLiquidityETH()` and `creatorAddLiquidityTokens()` after WETH/tokens are transferred to the pool.

### User Liquidity Provision

| Function | Access | Modifiers | Deficit Required |
|---|---|---|---|
| `userProvideBankXLiquidity(address to)` | `external` | `lock`, `blockDelay(to)` | `bucket2 == true` |
| `userProvideXSDLiquidity(address to)` | `external` | `lock`, `blockDelay(to)` | `bucket1 == true` |
| `userProvideCollatPoolLiquidity(address to, uint amount)` | `external` | `lock` | `bucket3 == true` |

Each function:
1. Reads the newly deposited WETH amount from pool balance delta.
2. Converts to ETH value using `eth_usd_price()`.
3. Mints the appropriate token amount to the pool (XSD or BankX).
4. Calls `pid_controller.amountPaid*()` to update bucket progress.
5. Routes to the correct tier (1, 2, or 3) based on how much of the deficit has been filled.

### Reward Redemption

| Function | Access | Modifiers | Description |
|---|---|---|---|
| `LiquidityRedemption(address pool, address to)` | `external` | `lock`, `blockDelay(to)` | Claims all matured vesting tiers for a given pool and user. Mints BankX and XSD to `to`. |

Redemption checks each tier independently:
- If `vestingtimestamp <= block.timestamp` and `ethvalue > 0` for that tier → redeem.
- Reward token amounts = `(usd_reward * 1e6) / current_price`.

### Admin (onlyByOwner)

| Function | Description |
|---|---|
| `setSmartContractOwner(address)` | Transfers ownership. |
| `renounceOwnership()` | Irreversibly sets owner to `address(0)`. |
| `resetAddresses(...)` | Bulk address reset for all contract references and vesting parameters. |

---

## Reward Rate Summary

| Pool | Tier | BankX (% of ETH value) | XSD (% of ETH value) |
|---|---|---|---|
| XSD/WETH | 1 | 109% | 5% |
| XSD/WETH | 2 | 109% | 2% |
| XSD/WETH | 3 | 109% | 0% |
| BankX/WETH | 1 | 108% | 5% |
| BankX/WETH | 2 | 108% | 2% |
| BankX/WETH | 3 | 109% | 0% |
| CollateralPool | 1 | 107% | 0% |
| CollateralPool | 2 | 107% | 0% |
| CollateralPool | 3 | 109% | 0% |

---

## Events

| Event | Parameters | When Emitted |
|---|---|---|
| `CreatorProvideBankXLiquidity(address, uint, uint)` | sender, amount0 (BankX), amount1 (WETH) | `creatorProvideBankXLiquidity()` |
| `CreatorProvideXSDLiquidity(address, uint, uint)` | sender, amount0 (XSD), amount1 (WETH) | `creatorProvideXSDLiquidity()` |
| `UserProvideBankXLiquidity(address, uint)` | provider, WETH amount | `userProvideBankXLiquidity()` |
| `UserProvideXSDLiquidity(address, uint)` | provider, WETH amount | `userProvideXSDLiquidity()` |
| `UserProvideCollatLiquidity(address, uint)` | provider, WETH amount | `userProvideCollatPoolLiquidity()` |
| `liquidityRedemption(address, uint, uint)` | provider, bankx minted, xsd minted | `LiquidityRedemption()` |

---

## Security Considerations

- **Deficit limit enforced per call.** `require((ethvalue + amountpaid) < difference * 3)` prevents filling the bucket beyond its capacity in a single call.
- **`blockDelay` on user provision.** Prevents flash-loan-based liquidity manipulation for BankX and XSD pools.
- **No `blockDelay` on collateral provision.** By design. `bucket3` represents a severe undercollateralisation event where immediate liquidity is prioritised over flash-loan protection.
