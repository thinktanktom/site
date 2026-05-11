# Collateral Ratio

## Overview

The collateral ratio (CR) is the fraction of every XSD token that is backed by real WETH collateral versus the algorithmic BankX token. It is stored in `PIDController.global_collateral_ratio` as a `uint256` with `1e6` precision.

At `CR = 1000000` (100%), every XSD minted requires WETH equal to the full silver-gram value of the XSD amount. At `CR = 850000` (85%), only 85% of the value needs to come from WETH; the remaining 15% is covered by burning BankX tokens. At `CR = 0`, XSD is purely algorithmic and backed entirely by BankX.

The protocol launches at `CR = 1000000` (fully collateralised) and adjusts dynamically over time.

---

## Key Concepts

- **`global_collateral_ratio`** — Stored in `PIDController`; read by `CollateralPool` for all mint/redeem calculations.
- **`xsd_step`** — The increment by which CR changes per `systemCalculations()` call. Default: `2500` (0.25% in 1e6 precision).
- **`collateral_ratio_cooldown`** — Minimum elapsed time between CR updates (seconds). Set at initialisation by the owner.
- **`growth_ratio`** — Ratio of BankX market cap (in the AMM pool) to uncollateralised XSD supply. Used optionally to inform CR direction.
- **`GR_top_band` / `GR_bottom_band`** — Tolerance bands around `growth_ratio` for the growth-ratio-based CR adjustment mode. Default: `1000` each.
- **`FIP_6`** — Optional mode that restricts `systemCalculations()` calls to when XSD is outside its price band.

---

## CR Adjustment Logic

`systemCalculations()` in `PIDController` is callable by anyone (subject to `collateral_ratio_paused == false`). Each call:

1. Reads current XSD and BankX spot prices from the AMM pools (10-slot rolling average).
2. Computes the silver band:
   ```solidity
   uint256 silver_price = (XSD.xag_usd_price() * 1e4) / 311035;
   uint256 XSD_top_band  = silver_price + (xsd_percent * silver_price) / 100;
   uint256 XSD_bottom_band = silver_price - (xsd_percent * silver_price) / 100;
   ```
3. Decides the CR direction:
   - `xsdprice > XSD_top_band` → decrease CR (XSD is above peg, less collateral needed).
   - `xsdprice < XSD_bottom_band` → increase CR (XSD is below peg, more collateral needed).
   - If within band and `use_growth_ratio` is enabled: adjust CR based on BankX market cap growth.
4. Enforces the cooldown (`collateral_ratio_cooldown`), then applies the delta and emits `PIDCollateralRatioRefreshed`.
5. Updates the interest rate:
   ```solidity
   uint256 _interest_rate = (1000000 - global_collateral_ratio) / 2;
   interest_rate = _interest_rate > 52800 ? _interest_rate : 52800;
   ```
   Interest rate has a floor of `52800` (~5.28% annual).

---

## Mint Modes by CR

| CR Range | Mint Function | Collateral Required |
|---|---|---|
| `CR == 1000000` (100%) | `mint1t1XSD()` | WETH only |
| `0 < CR < 1000000` | `mintFractionalXSD()` | WETH + BankX (burned) |
| `CR == 0` | `mintAlgorithmicXSD()` | BankX only (burned) |

Similarly for redemptions:

| CR Range | Redeem Function | Output |
|---|---|---|
| `CR == 1000000` | `redeem1t1XSD()` | WETH + accrued interest in BankX |
| `0 < CR < 1000000` | `redeemFractionalXSD()` | WETH + BankX + accrued interest |
| `CR == 0` | `redeemAlgorithmicXSD()` | BankX only + accrued interest |

---

## CR Precision Example

```solidity
// CR = 85% encoded as:
uint256 global_collateral_ratio = 850000; // 850000 / 1e6 = 0.85

// WETH needed to mint 1 XSD (in USD terms):
uint256 weth_dollar_needed = silver_price * global_collateral_ratio; // 85% of silver gram price

// BankX needed to mint 1 XSD (in USD terms):
uint256 bankx_dollar_needed = silver_price * 1e6 - weth_dollar_needed; // 15% of silver gram price
```

---

## Interest Rate and CR

The interest rate paid to minters is derived directly from the CR:

```
interest_rate = max((1,000,000 - global_collateral_ratio) / 2, 52,800)
```

At 100% CR: `interest_rate = max(0, 52800) = 52800` (~5.28% annual).
At 85% CR: `interest_rate = max(75000, 52800) = 75000` (~7.5% annual).
At 0% CR: `interest_rate = max(500000, 52800) = 500000` (~50% annual).

The higher the algorithmic fraction, the more minters are compensated for the additional protocol risk they absorb.

---