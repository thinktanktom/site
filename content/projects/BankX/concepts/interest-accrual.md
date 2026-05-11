# Interest Accrual

## Overview

Every user who mints XSD through the `CollateralPool` earns interest on their outstanding principal for the entire duration XSD remains in circulation. Interest is paid in BankX tokens at the time of redemption. The rate is dynamic, derived from the current collateral ratio, and uses a weighted-average model that correctly handles multiple mint and partial-redeem operations over time.

---

## Key Concepts

- **Principal (`amount`)** — The total XSD currently outstanding for a given minter's address.
- **Weighted-average interest rate (`interest_rate`)** — The blended rate across all of a minter's historical mint operations at different rates.
- **Accumulated interest (`accum_interest`)** — The dollar-denominated interest earned so far, stored in 1e6 precision. Paid in BankX at redemption.
- **Timestamp (`time`)** — The block timestamp of the minter's last interaction (mint or redeem).
- **Protocol interest rate** — Set by the `PIDController` as `max((1,000,000 - global_collateral_ratio) / 2, 52800)`. Floor is 52,800 (~5.28% per year).

---

## The `MintInfo` Struct

The `CollateralPool` stores per-address state in `mintMapping`:

```solidity
struct MintInfo {
    uint256 accum_interest;  // Accumulated interest in USD (1e6 precision)
    uint256 interest_rate;   // Weighted-average annual rate (1e6 precision)
    uint256 time;            // Timestamp of last interaction
    uint256 amount;          // Total XSD outstanding for this address
}
```

---

## Accumulation Formula

Interest accumulates in `CollateralPoolLibrary.calcMintInterest()`:

```solidity
uint256 gram_price = (silver_price * 1e4) / 311035;
// delta_t is the number of whole days since last interaction
uint256 delta_t = (block.timestamp - time) / 86400;

accum_interest += (amount * gram_price * interest_rate * delta_t) / (365 * 1e12);
```

**Units breakdown:**
- `amount` — XSD tokens (1e18)
- `gram_price` — Silver gram price in USD (1e6)
- `interest_rate` — Annual rate (1e6; e.g. 52800 = 5.28%)
- `delta_t` — Days (integer)
- Divisor `365 * 1e12` normalises the result to 1e12 precision

The result, `accum_interest`, accumulates in a precision that is settled to BankX tokens at redemption using the current BankX price.

---

## Weighted-Average Rate Update

When a user mints additional XSD on top of an existing position, the system recalculates a weighted-average rate so that neither the old nor new tranche is charged the wrong rate:

```solidity
// New weighted average:
interest_rate = (amount * interest_rate + XSD_amount * rate) / (amount + XSD_amount);
amount = amount + XSD_amount;
time = block.timestamp;
```

This is a standard weighted mean, weighted by XSD principal size. The rate used for the new tranche (`rate`) is the current `PIDController.interest_rate` at the time of that mint.

On the **first** mint (`time == 0`), there is no prior accrual; the rate and amount are initialised directly:

```solidity
interest_rate = rate;    // current protocol rate
amount = XSD_amount;     // initial principal
time = block.timestamp;  // start timestamp
```

---

## Redemption Interest Calculation

When a user redeems XSD, `calcRedemptionInterest()` first accrues to the current timestamp, then reduces the principal:

```solidity
uint256 gram_price = (silver_price * 1e4) / 311035;
uint256 delta_t = (block.timestamp - time) / 86400;
accum_interest += (amount * gram_price * interest_rate * delta_t) / (365 * 1e12);
amount = amount - XSD_amount;
time = block.timestamp;
```

Note that the `interest_rate` is **not** recalculated on redemption — the weighted average persists unchanged. Only the principal decreases. Accrual continues on the reduced balance going forward.

---

## Interest Payment at Redemption

At the point of a redeem call, the pool computes the minter's proportional share of accumulated interest:

```solidity
uint256 current_accum_interest = (XSD_amount * mintMapping[msg.sender].accum_interest) / total_xsd_amount;
```

This is converted to a BankX token amount:

```solidity
uint256 bankx_amount = (current_accum_interest * 1e6) / pid_controller.bankx_updated_price();
```

The BankX is minted to the pool and queued in `redeemBankXTokenBalances[msg.sender]` for collection after the block delay. The accumulated interest is decremented proportionally.

---

## Example Walk-Through

Assume silver = $25/oz → gram price = $0.0804, protocol rate = 52800 (5.28% annual).

1. **Day 0:** Alice mints 1000 XSD.
   - `amount = 1000e18`, `interest_rate = 52800`, `time = now`, `accum_interest = 0`.

2. **Day 365:** Alice mints 500 more XSD (rate now 60000 = 6%).
   - Accrual: `1000 * 0.0804 * 52800 / 1e6 * 365 / 365 ≈ $4.24` accumulates.
   - New weighted rate: `(1000 * 52800 + 500 * 60000) / 1500 = 55200`.
   - `amount = 1500e18`, `interest_rate = 55200`.

3. **Day 730:** Alice redeems all 1500 XSD.
   - Final accrual on 1500 XSD at rate 55200 for 365 days.
   - Total `accum_interest` is converted to BankX at the current BankX price and paid out.

---

## Security Considerations

- **Integer time resolution.** The formula uses whole days (`delta_t = elapsed_seconds / 86400`). Sub-day accrual is lost. Minters should not rely on sub-daily precision.
- **Overredemption guard.** `require(XSD_amount <= mintMapping[msg.sender].amount)` prevents a user from redeeming more XSD than they originally minted through this pool.
