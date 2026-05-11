# Reentrancy Protection

## Overview

BankX employs multiple layers of reentrancy protection across all contracts that move ETH or tokens. The primary mechanisms are OpenZeppelin's `ReentrancyGuard`, UniswapV2-style mutex locks, the two-step redemption pattern, and the Checks-Effects-Interactions (CEI) pattern in critical functions.

---

## Contract-Level Protections

### CollateralPool — OpenZeppelin ReentrancyGuard

`CollateralPool` inherits OpenZeppelin's `ReentrancyGuard` and applies `nonReentrant` to every state-changing user function:

| Function | `nonReentrant` |
|---|---|
| `mint1t1XSD()` | Yes |
| `mintFractionalXSD()` | Yes |
| `mintAlgorithmicXSD()` | Yes |
| `redeem1t1XSD()` | Yes |
| `redeemFractionalXSD()` | Yes |
| `redeemAlgorithmicXSD()` | Yes |
| `collectRedemption()` | Yes |

Note: `buyBackBankX()` and `buyBackXSD()` do **not** carry `nonReentrant`. They use `blockDelay` as an alternative. Integrators should be aware that buyback functions do not have the mutex guard.

### Router — OpenZeppelin ReentrancyGuard

`Router` inherits `ReentrancyGuard` and applies `nonReentrant` to all four swap functions (`swapETHForXSD`, `swapXSDForETH`, `swapETHForBankX`, `swapBankXForETH`). Liquidity functions (`userAddLiquidityETH`, `creatorAddLiquidity*`) do not carry `nonReentrant`.

### AMM Pools — UniswapV2-Style Mutex

Both `XSDWETHpool` and `BankXWETHpool` use a `uint private unlocked = 1` mutex via the `lock` modifier:

```solidity
modifier lock() {
    require(unlocked == 1, 'UniswapV2: LOCKED');
    unlocked = 0;
    _;
    unlocked = 1;
}
```

Applied to: `swap()`, `skim()`, `sync()`.

Additionally, `BankXWETHpool` inherits OpenZeppelin's `ReentrancyGuard` and applies it to `skim()` and `sync()` (double protection). `XSDWETHpool` uses only the mutex.

### RewardManager — UniswapV2-Style Mutex

`RewardManager` uses the same `lock` mutex pattern applied to all liquidity provision and redemption functions.

---

## Two-Step Redemption Pattern

The most significant architectural reentrancy defence is the **two-step redemption** design in `CollateralPool`. This pattern was explicitly chosen to prevent flash-loan attacks:

**Step 1 — Redeem call:**
- Burns XSD from the caller immediately.
- Queues the owed WETH and BankX in internal accounting mappings.
- Records `lastRedeemed[msg.sender] = block.number`.
- No ETH or tokens are transferred out.

**Step 2 — `collectRedemption()` call:**
- Requires `block.number >= lastRedeemed[msg.sender] + block_delay` (default 2 blocks).
- Reads queued amounts, zeroes them (effects before interactions).
- Transfers WETH (unwrapped to ETH) and BankX tokens.

Because XSD is burned in step 1 and collateral is only transferred in step 2 (after multiple blocks), a flash loan cannot borrow capital, mint XSD, immediately redeem, and repay the loan in a single transaction.

---

## Checks-Effects-Interactions

`collectRedemption()` follows CEI explicitly:

```solidity
// Checks (implicit via blockDelay modifier and bucket3 check)

// Effects — zero out state before any transfers
if (bankxAmount > 0) {
    redeemBankXBalances[msg.sender] = 0;
    redeemBankXTokenBalances[msg.sender] = 0;
    unclaimedPoolBankX = unclaimedPoolBankX - bankxAmount;
}
if (collateralDollarAmount > 0) {
    redeemCollateralBalances[msg.sender] = 0;
    unclaimedPoolCollateral = unclaimedPoolCollateral - collateralDollarAmount;
}

// Interactions — external calls after state is cleared
if (bankxAmount > 0) {
    TransferHelper.safeTransfer(address(BankX), msg.sender, bankxAmount);
}
if (collateralAmount > 0) {
    IWETH(WETH).withdraw(collateralAmount);
    TransferHelper.safeTransferETH(msg.sender, collateralAmount);
}
```

---

## ETH Receive Restrictions

Both `CollateralPool` and `Router` restrict which contracts can send ETH via `receive()`:

```solidity
receive() external payable {
    assert(msg.sender == WETH);
}
```

This prevents direct ETH sends to the contract from non-WETH sources, which could otherwise trigger fallback logic or interfere with accounting.

---

## Known Limitations

- **`buyBackBankX` and `buyBackXSD` lack `nonReentrant`.** While both require `blockDelay` (which prevents same-transaction reentrancy), there is no mutex if a reentrant call arrives from a contract that already has a valid `priceCheck`. Integrators should not build contracts that call these functions recursively.
- **`skim()` on XSDWETHpool uses only `lock`, not `nonReentrant`.** The `lock` mutex provides equivalent protection within a single transaction, but OpenZeppelin's `ReentrancyGuard` provides an additional storage slot check that `lock` does not.
- **`userAddLiquidityETH()` in Router is not `nonReentrant`.** A call chain that routes through an attacker-controlled ERC-20's `transfer` hook could theoretically reenter. In practice, the only tokens involved are WETH, XSD, and BankX — all of which are non-rebasing and do not have hooks — so this is not an active attack vector with the current pool whitelist.
