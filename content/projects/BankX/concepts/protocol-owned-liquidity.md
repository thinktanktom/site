# Protocol-Owned Liquidity

## Overview

BankX maintains active liquidity depth in both the XSD/WETH and BankX/WETH AMM pools through a Protocol-Owned Liquidity (POL) model. Rather than relying purely on external LPs, the protocol detects liquidity deficits via the PID Controller's three deficit buckets and incentivises community members to add liquidity in exchange for tiered BankX and XSD rewards — with the protocol itself acting as a liquidity provider of last resort through the treasury.

---

## Key Concepts

- **Deficit buckets** — Three boolean flags in `PIDController` (`bucket1`, `bucket2`, `bucket3`) that signal active liquidity or collateral deficits. Each bucket carries a `diff` (required amount), `timestamp`, and `amountpaid` (how much has been filled).
- **bucket1** — XSD/WETH pool has insufficient WETH liquidity relative to total XSD value at the `xsd_percentage_target` threshold. Active for up to 18 hours (`64800` seconds).
- **bucket2** — BankX/WETH pool has insufficient WETH liquidity relative to BankX Certificate of Deposit supply at the `bankx_percentage_target` threshold. Active for up to 18 hours.
- **bucket3** — `CollateralPool` is undercollateralised: `collatValue * 400 <= 3 * XSDvalue`. Active for up to 7 days (`604800` seconds). While active, **redemptions are blocked**.
- **`amountpaid`** — Tracks how much ETH-equivalent value has been added to each deficit pool so far. Buckets reset when `amountpaid >= diff` or the time window expires.
- **`xsd_percentage_target` / `bankx_percentage_target`** — Owner-set percentage thresholds for how much of the token's market cap should be backed by AMM liquidity.

---

## Deficit Detection

`systemCalculations()` calls three internal checkers:

### incentiveChecker1 — XSD/WETH Deficit

```solidity
uint XSDvalue = (XSD.totalSupply() * silver_price) / 1e6;
uint reserve = (xsdweth_reserve * XSD.eth_usd_price() * 2) / 1e6; // both sides of pool
if (reserve < (XSDvalue * xsd_percentage_target) / 100) {
    bucket1 = true;
    diff1 = (((XSDvalue * xsd_percentage_target) / 100) - reserve) / 2;
    timestamp1 = block.timestamp;
}
```

The deficit `diff1` is split into thirds — each third defines one reward tier.

### incentiveChecker2 — BankX/WETH Deficit

Similar logic, but compares BankX AMM reserves against `cd_allocated_supply` (BankX Certificate of Deposit supply) weighted by `bankx_percentage_target`.

### incentiveChecker3 — Collateral Pool Deficit

```solidity
uint XSDvalue = (collateralpool.collat_XSD() * silver_price * global_collateral_ratio) / 1e12;
if (collatValue * 400 <= 3 * XSDvalue) {
    bucket3 = true;
    diff3 = (3 * XSDvalue) - (collatValue * 400);
}
```

This is a 75% collateralisation threshold (`400/3 ≈ 133%` overcollateralisation required before bucket3 clears).

---

## Liquidity Provision: Tiered Reward System

When a deficit bucket is active, users can add WETH to the affected pool via the `Router` (`userAddLiquidityETH()`) and earn tiered rewards from the `RewardManager`.

### Tier Structure

Each deficit `diff` is split into three equal thirds:
- **Tier 1** — First third of the deficit. Rewards vest at `vesting1`.
- **Tier 2** — Second third of the deficit. Rewards vest at `vesting2`.
- **Tier 3** — Final third. Rewards vest at `vesting3`.

### Reward Rates by Pool

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

Rewards are denominated in USD (ETH value) and converted to token amounts at the current BankX and XSD prices at the time of redemption.

---

## Creator (Treasury) Liquidity

The treasury and contract owner can add liquidity directly via `Router.creatorAddLiquidityTokens()` and `creatorAddLiquidityETH()` without earning tiered rewards. The `RewardManager.creatorProvideXSDLiquidity()` and `creatorProvideBankXLiquidity()` functions call `sync()` on the respective pool and update `amountpaid` in the PID Controller if a bucket is active.

---

## Reward Redemption

After the vesting period expires, users call `Router.userRedeemLiquidity(pool, deadline)`, which calls `RewardManager.LiquidityRedemption(pool, msg.sender)`. The function:

1. Checks which vesting tiers have matured (`vestingtimestamp <= block.timestamp`).
2. Converts stored USD-denominated rewards to BankX and XSD token amounts using current PID prices.
3. Mints BankX and XSD directly to the user's address.

---

## Security Considerations

- **Deficit limit.** Each `userProvide*Liquidity()` call enforces `(ethvalue + amountpaid) < difference * 3` to prevent overfilling a deficit bucket beyond its capacity.
- **`blockDelay` on provision.** Users providing BankX or XSD pool liquidity must have a recent `priceCheck` in the PID Controller — same anti-flash-loan delay as minting/redeeming.
- **Collateral pool provision has no `blockDelay`.** `userProvideCollatPoolLiquidity()` does not carry the blockDelay modifier, reflecting the urgency of `bucket3` events.
- **`bucket3` blocks redemptions.** While `bucket3` is active, all `CollateralPool` redeem functions revert with "Cannot withdraw in times of deficit". This prevents a bank-run scenario during a collateral shortfall.
