# Adding Collateral (Liquidity Provision)

## Overview

Adding collateral to the BankX protocol means providing WETH to one of three pools: the XSD/WETH AMM pool (bucket1 deficit), the BankX/WETH AMM pool (bucket2 deficit), or the CollateralPool (bucket3 deficit). Liquidity is only rewarded when a deficit bucket is active. The process is managed through the `Router`, which delegates to the `RewardManager` for reward accounting.

---

## Which Pool Should I Provide To?

| Deficit Active | Target Pool | Reward Tokens |
|---|---|---|
| `bucket1 == true` | XSD/WETH pool (`xsd_pool_address`) | BankX + XSD |
| `bucket2 == true` | BankX/WETH pool (`bankx_pool_address`) | BankX + XSD |
| `bucket3 == true` | CollateralPool (`collat_pool_address`) | BankX only |

Check deficit status:
```solidity
IPIDController pid = IPIDController(PID_ADDRESS);
bool xsd_deficit    = pid.bucket1();
bool bankx_deficit  = pid.bucket2();
bool collat_deficit = pid.bucket3();
```

---

## Step-by-Step: Providing Liquidity

### For XSD/WETH or BankX/WETH Pools

These require a prior `priceCheck` (block-delay mechanism).

```solidity
// Step 1: Check that the deficit is active
require(IPIDController(PID_ADDRESS).bucket1(), "No XSD pool deficit"); // for XSD/WETH

// Step 2: Call priceCheck on PID Controller
IPIDController(PID_ADDRESS).priceCheck();

// Step 3: Wait block_delay blocks (typically 2)

// Step 4: Provide ETH via Router
IRouter(ROUTER_ADDRESS).userAddLiquidityETH{value: ethAmount}(
    XSD_POOL_ADDRESS,     // or BANKX_POOL_ADDRESS
    block.timestamp + 300 // deadline
);
```

The Router wraps ETH to WETH, sends it to the pool, and calls `RewardManager.userProvideXSDLiquidity()` or `userProvideBankXLiquidity()`.

### For CollateralPool (bucket3)

No `blockDelay` required — urgency takes priority.

```solidity
require(IPIDController(PID_ADDRESS).bucket3(), "No collateral deficit");

IRouter(ROUTER_ADDRESS).userAddLiquidityETH{value: ethAmount}(
    COLLATERAL_POOL_ADDRESS,
    block.timestamp + 300
);
```

---

## Reward Tiers

Each deficit's total required amount (`diff`) is split into three equal thirds. Your reward tier is determined by how much of the deficit has already been filled at the time you provide liquidity:

| Phase | Condition | Vesting | BankX Rate | XSD Rate |
|---|---|---|---|---|
| Tier 1 | `amountpaid < diff/3` | `vesting1` | ~107–109% of ETH value | 5% (XSD/BankX pools) / 0% (collat) |
| Tier 2 | `amountpaid < 2*diff/3` | `vesting2` | ~107–109% of ETH value | 2% (XSD/BankX pools) / 0% (collat) |
| Tier 3 | `amountpaid < diff` | `vesting3` | ~109% of ETH value | 0% |

Check how much has been filled:
```solidity
uint256 filled = pid.amountpaid1(); // for bucket1
uint256 total  = pid.diff1();
uint256 tier1_end = total / 3;
uint256 tier2_end = (total * 2) / 3;
```

---

## Capacity Check

The total liquidity provided must not exceed the deficit capacity:
```solidity
require((ethvalue + amountpaid) < difference * 3, "Deficit limit reached");
```

If your provision would overfill the deficit, the transaction reverts. Split into multiple smaller transactions or wait for the current deficit to clear and a new one to open.

---

## Redeeming Liquidity Rewards

After the vesting period:

```solidity
// Step 1: priceCheck
IPIDController(PID_ADDRESS).priceCheck();

// Step 2: Wait block_delay blocks

// Step 3: Redeem
IRouter(ROUTER_ADDRESS).userRedeemLiquidity(
    POOL_ADDRESS,         // the pool you provided to
    block.timestamp + 300
);
```

The `RewardManager` converts your stored USD-denominated rewards to BankX and XSD token amounts at the current PID prices and mints them directly to your address.

---

## Creator (Treasury) Liquidity

The treasury and owner can add liquidity at any time without earning rewards:

```solidity
// Add ETH to a pool (treasury or owner only):
IRouter(ROUTER_ADDRESS).creatorAddLiquidityETH{value: ethAmount}(
    POOL_ADDRESS,
    block.timestamp + 300
);

// Add XSD or BankX tokens to pool (treasury or owner only):
IERC20(TOKEN_ADDRESS).approve(ROUTER_ADDRESS, tokenAmount);
IRouter(ROUTER_ADDRESS).creatorAddLiquidityTokens(
    TOKEN_ADDRESS,
    tokenAmount,
    block.timestamp + 300
);
```

---

## Notes for Integrators

- The `userAddLiquidityETH()` call will revert if `liquidity_paused == true` on the Router.
- If your provision spans tier boundaries (e.g. you provide enough to cover the end of tier 1 and part of tier 2), the RewardManager automatically splits your contribution across tiers with the appropriate rates.
- Vesting timestamps are set at the time of provision. Providing additional liquidity in the same tier does not reset the vesting clock for previously provided amounts.
