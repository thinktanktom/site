# Redeeming XSD

## Overview

Redeeming XSD returns WETH collateral and BankX tokens to the minter. The process is always two steps: a **redeem call** (burns XSD, queues assets) and a **collect call** (`collectRedemption()`, transfers queued assets). The two-step design prevents flash-loan exploitation. The correct redeem function depends on the current `global_collateral_ratio`.

:::warning
Redemption is blocked when `pid_controller.bucket3() == true` (severe collateral deficit). All redeem functions and `collectRedemption()` revert in this state. Redemptions resume when the deficit is resolved.
:::

---

## Pre-Flight Requirements

All redeem functions require `blockDelay`:

1. Call `pid_controller.priceCheck()`.
2. Wait `block_delay` blocks (default: 2).
3. Call the redeem function.
4. Wait `block_delay` blocks again.
5. Call `priceCheck()` again.
6. Call `collectRedemption()`.

You must also have XSD approved to the `CollateralPool`:
```solidity
IERC20(XSD_ADDRESS).approve(COLLATERAL_POOL_ADDRESS, XSD_amount);
```

---

## Mode 1: 1:1 Redeem (CR = 100%)

Used when `global_collateral_ratio == 1000000`.

Returns: **WETH + accrued interest in BankX**.

```solidity
// Step 1: priceCheck
IPIDController(PID_ADDRESS).priceCheck();
// Step 2: Wait block_delay blocks

// Step 3: Approve XSD
IERC20(XSD_ADDRESS).approve(COLLATERAL_POOL_ADDRESS, XSD_amount);

// Step 4: Redeem (queues assets)
ICollateralPool pool = ICollateralPool(payable(COLLATERAL_POOL_ADDRESS));
pool.redeem1t1XSD(
    XSD_amount,
    COLLATERAL_out_min,   // minimum WETH to receive (slippage guard)
    block.timestamp + 300
);

// Step 5: Wait block_delay blocks, call priceCheck again
IPIDController(PID_ADDRESS).priceCheck();
// Step 6: Collect
pool.collectRedemption();
```

---

## Mode 2: Fractional Redeem (0 < CR < 100%)

Used when `0 < global_collateral_ratio < 1000000`.

Returns: **WETH + BankX (CR split) + accrued interest in BankX**.

```solidity
IPIDController(PID_ADDRESS).priceCheck();
// Wait block_delay blocks

IERC20(XSD_ADDRESS).approve(COLLATERAL_POOL_ADDRESS, XSD_amount);

pool.redeemFractionalXSD(
    XSD_amount,
    BankX_out_min,        // minimum BankX to receive
    COLLATERAL_out_min,   // minimum WETH to receive
    block.timestamp + 300
);

// Wait block_delay blocks
IPIDController(PID_ADDRESS).priceCheck();
pool.collectRedemption();
```

---

## Mode 3: Algorithmic Redeem (CR = 0%)

Used when `global_collateral_ratio == 0`. Returns BankX only (no WETH).

```solidity
IPIDController(PID_ADDRESS).priceCheck();
// Wait block_delay blocks

IERC20(XSD_ADDRESS).approve(COLLATERAL_POOL_ADDRESS, XSD_amount);

pool.redeemAlgorithmicXSD(
    XSD_amount,
    BankX_out_min,
    block.timestamp + 300
);

// Wait block_delay blocks
IPIDController(PID_ADDRESS).priceCheck();
pool.collectRedemption();
```

---

## What Happens During a Redeem Call

1. **Bucket3 check:** Reverts if `bucket3 == true`.
2. **Overredemption guard:** `XSD_amount <= mintMapping[msg.sender].amount`.
3. **Interest accrual:** `redeemInterestCalc()` updates accumulated interest to the current block.
4. **Proportional interest split:** `current_accum_interest = (XSD_amount * accum_interest) / total_amount`.
5. **Asset queuing:**
   - `redeemCollateralBalances[msg.sender]` incremented (USD value of WETH owed).
   - `redeemBankXTokenBalances[msg.sender]` incremented (BankX tokens owed: principal split + interest).
   - `unclaimedPoolCollateral` and `unclaimedPoolBankX` updated.
6. **XSD burned:** `XSD.pool_burn_from(msg.sender, XSD_amount)`.
7. **BankX minted to pool:** `BankX.pool_mint(address(this), bankx_amount)`.
8. **`lastRedeemed[msg.sender]`** set to `block.number`.

---

## What Happens During collectRedemption

`collectRedemption()` requires:
- `!pid_controller.bucket3()`
- `lastRedeemed[msg.sender] + block_delay <= block.number`
- Valid `priceCheck` in PID Controller (`blockDelay` modifier)

Steps:
1. Reads and zeroes `redeemBankXTokenBalances[msg.sender]` and `redeemCollateralBalances[msg.sender]`.
2. Computes WETH token amount from USD value: `collateralAmount = collateralDollarAmount * 1e6 / eth_usd_price`.
3. Decrements `unclaimedPoolBankX` and `unclaimedPoolCollateral`.
4. Transfers BankX tokens to the caller.
5. Calls `IWETH.withdraw(collateralAmount)` then sends ETH to caller.

The caller receives native ETH (unwrapped from WETH), not WETH tokens.

---

## Interest Received

At redemption, the caller receives their proportional share of accrued interest, converted to BankX tokens:

```
interest_in_bankx = (proportional_accum_interest * 1e6) / bankx_updated_price
```

This is added on top of the BankX returned as part of the CR split (in fractional/algorithmic modes).

---

## Overredemption Guard

```solidity
require(XSD_amount <= mintMapping[msg.sender].amount, "OVERREDEMPTION ERROR");
```

A user can only redeem up to the total XSD they personally minted. They cannot redeem XSD purchased on the open market through the CollateralPool — only the address that minted can redeem against that position.

:::note
Users can burn purchased XSD via `XSD.burnUserXSD()` without receiving collateral. This is separate from the redemption flow.
:::
