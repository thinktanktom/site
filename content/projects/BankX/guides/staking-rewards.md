# Staking and Liquidity Rewards

## Overview

BankX's reward system is deficit-driven rather than always-on. Rewards are distributed to users who provide liquidity when the protocol needs it most — when AMM pool depths fall below target thresholds or when the collateral pool is undercollateralised. There is no continuous "staking APY"; instead, the protocol offers elevated, time-limited rewards during deficit events.

---

## Reward Lifecycle

```
1. PID Controller detects deficit (systemCalculations())
   └─ Sets bucket1, bucket2, or bucket3 = true
   └─ Stores: diff (total needed), timestamp

2. User sees deficit and provides ETH via Router
   └─ Router wraps ETH → WETH → sends to pool
   └─ RewardManager assigns rewards to a vesting tier

3. After vesting period expires
   └─ User calls Router.userRedeemLiquidity()
   └─ RewardManager mints BankX (+ XSD) to user
```

---

## Checking for Active Deficits

```solidity
IPIDController pid = IPIDController(PID_ADDRESS);

// Deficit flags
bool xsd_pool_deficit    = pid.bucket1();  // XSD/WETH needs liquidity
bool bankx_pool_deficit  = pid.bucket2();  // BankX/WETH needs liquidity
bool collateral_deficit  = pid.bucket3();  // CollateralPool undercollateralised

// Deficit size (USD, 1e18)
uint256 xsd_deficit_size    = pid.diff1();
uint256 bankx_deficit_size  = pid.diff2();
uint256 collat_deficit_size = pid.diff3();

// How much has been filled (USD, 1e18)
uint256 xsd_filled    = pid.amountpaid1();
uint256 bankx_filled  = pid.amountpaid2();
uint256 collat_filled = pid.amountpaid3();

// Remaining to fill:
uint256 xsd_remaining    = xsd_deficit_size    - xsd_filled;
uint256 bankx_remaining  = bankx_deficit_size  - bankx_filled;
uint256 collat_remaining = collat_deficit_size - collat_filled;
```

---

## Providing Liquidity

See [Adding Collateral](./adding-collateral.md) for the full step-by-step guide. Summary:

```solidity
// For XSD/WETH pool (bucket1):
IPIDController(PID_ADDRESS).priceCheck(); // required
// wait block_delay blocks
IRouter(ROUTER_ADDRESS).userAddLiquidityETH{value: ethAmount}(XSD_POOL_ADDRESS, deadline);

// For BankX/WETH pool (bucket2):
IPIDController(PID_ADDRESS).priceCheck();
// wait block_delay blocks
IRouter(ROUTER_ADDRESS).userAddLiquidityETH{value: ethAmount}(BANKX_POOL_ADDRESS, deadline);

// For CollateralPool (bucket3, no blockDelay):
IRouter(ROUTER_ADDRESS).userAddLiquidityETH{value: ethAmount}(COLLATERAL_POOL_ADDRESS, deadline);
```

---

## Reading Your Reward Position

Reward state is stored in:
```solidity
IRewardManager.liquidity_provider[pool][user][vesting_tier]
```

The struct contains:
- `vestingtimestamp` — when rewards become claimable
- `ethvalue` — ETH value you contributed (USD, 1e18)
- `xsdrewards` — XSD-denominated reward (USD, 1e18)
- `bankxrewards` — BankX-denominated reward (USD, 1e18)

```solidity
IRewardManager rm = IRewardManager(REWARD_MANAGER_ADDRESS);

// Vesting tiers (time values set during initialization)
uint256 vesting1 = rm.vesting1();
uint256 vesting2 = rm.vesting2();
uint256 vesting3 = rm.vesting3();

// Read tier 1 position in the XSD pool:
(uint ts, uint ethval, uint xsdrwd, uint bankxrwd) = rm.liquidity_provider(
    XSD_POOL_ADDRESS,
    msg.sender,
    vesting1
);
bool claimable = ts != 0 && block.timestamp >= ts;
```

---

## Claiming Rewards

Once `vestingtimestamp <= block.timestamp`:

```solidity
// priceCheck required before redemption
IPIDController(PID_ADDRESS).priceCheck();
// wait block_delay blocks

IRouter(ROUTER_ADDRESS).userRedeemLiquidity(
    POOL_ADDRESS,
    block.timestamp + 300
);
```

Rewards from all matured tiers (1, 2, 3) are claimed in a single call. Immature tiers are skipped.

The contract mints BankX and XSD directly to your wallet at the **current** PID Controller prices. Reward token quantity = `(usd_reward * 1e6) / current_token_price`.

---

## Reward Rate Reference

| Pool | Tier | BankX Reward | XSD Reward |
|---|---|---|---|
| XSD/WETH | 1 | ETH value × 109% | ETH value × 5% |
| XSD/WETH | 2 | ETH value × 109% | ETH value × 2% |
| XSD/WETH | 3 | ETH value × 109% | None |
| BankX/WETH | 1 | ETH value × 108% | ETH value × 5% |
| BankX/WETH | 2 | ETH value × 108% | ETH value × 2% |
| BankX/WETH | 3 | ETH value × 109% | None |
| CollateralPool | 1 | ETH value × 107% | None |
| CollateralPool | 2 | ETH value × 107% | None |
| CollateralPool | 3 | ETH value × 109% | None |

Rewards are denominated and stored in USD (ETH value). The BankX and XSD token amounts you actually receive depend on BankX and XSD prices **at the time of redemption**, not at the time of provision. This creates price exposure on your reward tokens.

---

## Deficit Duration Limits

Deficits automatically clear (bucket resets) if:

| Bucket | Auto-clear condition |
|---|---|
| bucket1 (XSD/WETH) | 18 hours elapsed OR `amountpaid1 >= diff1` |
| bucket2 (BankX/WETH) | 18 hours elapsed OR `amountpaid2 >= diff2` |
| bucket3 (CollateralPool) | 7 days elapsed OR `amountpaid3 >= diff3` |

When a bucket clears, no new reward positions can be opened for that event. Existing vesting positions continue to accrue and remain claimable after vesting.

---

## Key Risks

- **BankX price at redemption.** Rewards are stored in USD terms but paid in BankX. If BankX price rises significantly between provision and redemption, you receive fewer tokens (though higher value). If it falls, you receive more tokens.
- **Deficit may fill before your transaction lands.** The per-bucket capacity check (`(ethvalue + amountpaid) < diff * 3`) can cause your liquidity provision to revert if the bucket fills completely.
- **`liquidity_paused` can block provision.** Check `IRouter(ROUTER_ADDRESS).liquidity_paused()` before planning a transaction.
- **No rewards outside deficits.** Providing liquidity when no bucket is active via the standard `userAddLiquidityETH()` will revert in the RewardManager. Creator liquidity functions are the only way to add liquidity during non-deficit periods.
