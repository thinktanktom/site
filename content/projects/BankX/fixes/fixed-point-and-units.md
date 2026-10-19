# Fixed-Point & Unit Errors

Four items that share one failure: a quantity handled in the wrong denomination, or scaled in the wrong order. Three were caught in the contracts, one in the peg conversion constant itself. See [Fix History](/projects/BankX/fixes/overview) for scope and the full index.

---

## 2. XSDStablecoin.pool_price(): division before scaling

- **Commit:** `3264a85` (2024-09-15)
- **File:** `contracts/XSD/XSDStablecoin.sol` (`pool_price()`)
- **Category:** fixed-point math

**Before:**
```solidity
function pool_price(PriceChoice choice) internal view returns (uint256) {
    uint256 _eth_usd_price = (uint256(eth_usd_pricer.getLatestPrice())
        * PRICE_PRECISION) / (uint256(10) ** eth_usd_pricer_decimals);
    uint256 price_vs_eth = 0;
    uint256 reserve0;
    uint256 reserve1;
    if (choice == PriceChoice.XSD) {
        (reserve0, reserve1, ) = xsdEthPool.getReserves();
        if (reserve0 == 0 || reserve1 == 0) { return 1; }
        price_vs_eth = reserve0 / (reserve1);
    }
    // BankX branch mirrors this
    return _eth_usd_price / price_vs_eth;
}
```

**After:**
```solidity
function pool_price(PriceChoice choice) internal view returns (uint256) {
    uint256 _eth_usd_price = (uint256(eth_usd_pricer.getLatestPrice())
        * PRICE_PRECISION) / (uint256(10) ** eth_usd_pricer_decimals);
    uint256 price_vs_eth;
    uint256 reserve0;
    uint256 reserve1;
    if (choice == PriceChoice.XSD) {
        (reserve0, reserve1, ) = xsdEthPool.getReserves();
        if (reserve0 == 0 || reserve1 == 0) { return 1; }
        price_vs_eth = (reserve0 * pool_precision) / reserve1;
    }
    // BankX branch mirrors this
    uint256 price = (_eth_usd_price * pool_precision) / price_vs_eth;
    return price;
}
```

**Token ordering (verified, not assumed):** both `XSDWETHpool.sol` and `BankXWETHpool.sol` hardcode `token0` as the protocol token (XSD/BankX) and `token1` as WETH in their constructors — not Uniswap's address-sort convention. This ordering therefore holds by construction on every deployment of a given pool contract.

**Root cause:** `reserve0/reserve1` is a tokens-per-WETH ratio, ordinarily large (thousands), since one XSD or BankX token is worth a small fraction of one WETH. Integer division on a large ratio drops only the fractional remainder — a small precision loss that grows proportionally as the ratio shrinks. In thin or newly-seeded liquidity, where the ratio can fall below 1, it truncates to exactly **0**.

The existing `if (reserve0 == 0 || reserve1 == 0) return 1;` guard covers zero *reserves*, not a zero *ratio*, so `_eth_usd_price / price_vs_eth` then divides by that zero and reverts.

**Impact if unfixed:** the normal-liquidity case is silent precision drift — no revert, just plausible-looking numbers. The thin-liquidity case is a revert propagating to every caller of `pool_price()`: collateral-ratio math, mint/redeem pricing, interest calculations. See [XSD Stablecoin](/projects/BankX/contracts/xsd-stablecoin) for the current pricing surface.

---

## 4. CollateralPool redemption bookkeeping: BankX obligation tracked in dollars, owed in tokens

- **Commits:** `7a15bae` (2024-11-08), `fd516b4` (2024-11-21)
- **File:** `contracts/XSD/Pools/CollateralPool.sol`
- **Category:** settlement risk

Redemption has a mandatory `block_delay` between request and `collectRedemption()`. Before the fix, `unclaimedPoolBankX` — the pool's ledger of outstanding BankX owed — was credited in **dollars** at request time and converted to a BankX token amount only at claim time, using whatever `bankx_updated_price()` happened to be current at that later block.

**Before, `collectRedemption()`:**
```solidity
if (redeemBankXBalances[msg.sender] > 0) {
    BankXDollarAmount = redeemBankXBalances[msg.sender];
    BankXAmount = (BankXDollarAmount * 1e6) / pid_controller.bankx_updated_price();
    redeemBankXBalances[msg.sender] = 0;
    unclaimedPoolBankX = unclaimedPoolBankX - BankXDollarAmount;
    TransferHelper.safeTransfer(address(BankX), msg.sender, BankXAmount);
}
```

**After, `collectRedemption()`:**
```solidity
if (redeemBankXBalances[msg.sender] > 0) {
    BankXAmount = redeemBankXTokenBalances[msg.sender];
    redeemBankXBalances[msg.sender] = 0;
    redeemBankXTokenBalances[msg.sender] = 0;
    unclaimedPoolBankX = unclaimedPoolBankX - BankXAmount;
    TransferHelper.safeTransfer(address(BankX), msg.sender, BankXAmount);
}
```

**Credit side (`redeemInterestCalc`, `7a15bae`):**
```solidity
// before
unclaimedPoolBankX = (unclaimedPoolBankX + current_accum_interest);   // dollar-denominated
// after
uint256 bankx_amount = (current_accum_interest * 1e6) / pid_controller.bankx_updated_price();
unclaimedPoolBankX = (unclaimedPoolBankX + bankx_amount);              // token-denominated
redeemBankXTokenBalances[msg.sender] = (redeemBankXTokenBalances[msg.sender] + bankx_amount);
```

**What was verified**, by `grep unclaimedPoolBankX` on `fd516b4` and on current state: every write site to `unclaimedPoolBankX`, credit and debit, is token-denominated post-fix. `current_accum_interest` is itself dollar-denominated — confirmed by it only ever being used as `.../bankx_updated_price()` to derive a token amount, and by being credited directly into the dollar-named `redeemBankXBalances`.

So the pre-fix expression `bankx_dollar_value_d18 + current_accum_interest` summed two *dollar* figures, not two different units. **The defect is that the whole ledger was tracked in the wrong unit for what it represents** — not an intra-line unit mix. Worth being precise about, because the two have different fixes.

**Root cause:** a field meant to represent a fixed token liability was denominated in dollars and re-priced at an arbitrary later block.

**Impact if unfixed:** the redeemer's actual payout, and the pool's own internal ledger of outstanding BankX liabilities, both drift with BankX price movement during the mandatory delay window — a window that exists as a flash-loan and flash-mint guard, not as a pricing mechanism.

**Fix:** fix the token amount once at request time in `redeemBankXTokenBalances`; `collectRedemption()` then reads the precomputed figure with no second price lookup. That is the two-mapping arrangement [Collateral Pool](/projects/BankX/contracts/collateral-pool) and [Redeeming XSD](/projects/BankX/guides/redeeming-xsd) describe today.

---

## 5. CollateralPool collateral-availability check: dollar reserve subtracted from a WETH balance

- **Commit:** `abb17d6` (2024-12-31)
- **File:** `contracts/XSD/Pools/CollateralPool.sol`
- **Category:** unit mismatch

**Before:**
```solidity
require(
  collateral_needed <= (IWETH(WETH).balanceOf(address(this)) - unclaimedPoolCollateral),
  "Not enough collateral in pool"
);
```

**After:**
```solidity
uint CollateralAmount = (unclaimedPoolCollateral * 1e6) / XSD.eth_usd_price();
require(
  collateral_needed <= (IWETH(WETH).balanceOf(address(this)) - CollateralAmount),
  "Not enough collateral in pool"
);
```

**Root cause:** `unclaimedPoolCollateral` is a dollar-denominated reserve at 1e18 scale — per `fd516b4`, `weth_dollar_value = (neededWETH * eth_usd_price())/1e6 // precision of 1e18` — and it was being subtracted directly from a raw WETH token balance. `eth_usd_price()` is 1e6-scaled dollars-per-WETH (`PRICE_PRECISION = 1e6`).

**Dimensional check on the fix**, verified rather than assumed: `(dollars_1e18 * 1e6) / price_1e6 = dollars_1e18 / price_raw * 1e6` reduces to WETH-wei. The formula is dimensionally correct as written.

**Impact if unfixed:** the "reserved" amount subtracted is wrong by exactly the ETH/USD price factor. At a high ETH price, too little WETH is treated as reserved, so the pool can approve redemptions against collateral that isn't actually free. At a low ETH price, the check over-reserves and rejects valid redemptions.

---

## Minor: `24f4b07` (2022-08-01) — silver-peg conversion constant, wrong on first pass

The earliest mint/redeem math priced XSD as a flat $1 with no silver reference at all. This commit introduced a first conversion:

```solidity
gram_price = silver_price.mul(283495).div(1e4);
```

`283495` is the **avoirdupois**-ounce-to-gram constant (28.3495 g); XAG/USD oracles quote a **troy** ounce (31.1035 g). Both the constant and the multiply-vs-divide direction were wrong.

Current code — in `PIDController.sol`, `CollateralPoolLibrary.sol`, `CollateralPool.sol` and several other call sites:

```solidity
gram_price = (silver_price * 1e4) / 311035;
```

This is dimensionally correct (`$/troy-oz ÷ g/troy-oz = $/g`), and `311035` is the constant documented on [Silver Peg](/projects/BankX/concepts/silver-peg).
