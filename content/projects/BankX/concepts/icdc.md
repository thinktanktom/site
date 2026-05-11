# Individual Created Digital Currency (ICDC)

## Overview

Individual Created Digital Currency (ICDC) is the core philosophical and technical concept underlying BankX. It describes a model in which individual users — not banks, not central authorities — create currency by depositing their own collateral, receive that currency directly, earn interest on it, and redeem it on their own terms without risk of liquidation.

ICDC is the protocol's answer to the question: what does it look like for money creation to belong to the individual rather than to financial institutions?

---

## Key Concepts

- **Self-sovereign minting.** Any user can deposit WETH into the `CollateralPool` and call `mint1t1XSD()` or `mintFractionalXSD()` to create XSD. No approval from the protocol or a third party is required.
- **Collateral ownership.** The user's deposited WETH remains in the `CollateralPool` and is returnable on redemption. The protocol does not lend it out or use it for yield farming.
- **No liquidation.** A minter's position is never liquidated regardless of how the XSD price, BankX price, or collateral ratio moves. The only way a minter loses access to their collateral is through voluntary redemption.
- **Interest income.** Minters earn interest on their outstanding XSD for the entire duration it remains in circulation. Interest accrues continuously and is paid in BankX tokens upon redemption.
- **Permissionless exit.** A minter can redeem their XSD at any time (subject to the two-block redemption delay and the absence of an active `bucket3` collateral deficit).

---

## ICDC vs Traditional Banking

| Property | Traditional Bank | BankX ICDC |
|---|---|---|
| Who creates currency | Bank (fractional reserve) | Individual user |
| Collateral ownership | Bank holds deposits | User's WETH remains claimable |
| Liquidation risk | Yes (margin calls, forced sales) | No |
| Interest direction | User pays interest (borrower) | User earns interest (minter) |
| Permissioning | KYC, credit checks | Permissionless, wallet-based |
| Counterparty | Bank as intermediary | Smart contract, no intermediary |

---

## How ICDC Works in Practice

1. **Deposit.** The user sends ETH with a call to `mint1t1XSD()` (or `mintFractionalXSD()` with additional BankX approval). The ETH is wrapped to WETH inside the `CollateralPool`.

2. **Mint.** The pool mints XSD directly to the caller's address. The protocol records the mint in `mintMapping[msg.sender]`: the amount minted, the current interest rate, and the timestamp.

3. **Hold and earn.** The user holds XSD. Interest accrues on their outstanding principal using the weighted-average interest formula. The longer XSD is held, the more interest accumulates.

4. **Redeem.** The user calls a redeem function with their XSD amount. The pool:
   - Burns the XSD.
   - Queues WETH (or WETH + BankX at fractional CR) in `redeemCollateralBalances` and `redeemBankXTokenBalances`.
   - Mints BankX to the pool representing the accrued interest.
   - Updates `mintMapping` to reflect the reduced principal.

5. **Collect.** After `block_delay` blocks, the user calls `collectRedemption()` to receive their WETH and BankX. The two-step design prevents flash-loan exploitation of the redemption mechanics.

---

## The No-Liquidation Guarantee

The absence of liquidation is enforced by design at the contract level — there is no `liquidate()` function. The `CollateralPool` has no mechanism to seize a minter's collateral.

The system protects solvency instead through:
- The PID Controller increasing CR (requiring more collateral per XSD) when XSD falls below peg.
- The `bucket3` deficit mechanism, which temporarily blocks redemptions when the collateral pool is severely undercollateralised and triggers community-incentivised liquidity provision.
- Buyback functions (`buyBackBankX`, `buyBackXSD`) that let users absorb excess collateral when the pool is over-collateralised.

The no-liquidation guarantee does not mean losses are impossible. If a minter redeems at a time when silver prices have fallen, the USD value of their returned WETH may be lower than when they minted. The XSD peg tracks silver, not dollars.

