# AMM Pools: XSDWETHpool & BankXWETHpool

## Overview

BankX operates two custom AMM pools forked from UniswapV2: `XSDWETHpool` (XSD ↔ WETH) and `BankXWETHpool` (BankX ↔ WETH). Both pools use the constant-product invariant (`k = reserve0 * reserve1`) for pricing but diverge in fee structure and access control. Swaps are gated exclusively to the `Router` contract. Liquidity provision does not mint LP tokens — instead, liquidity is tracked and rewarded through the `RewardManager`.

---

## Key Concepts

- **No LP tokens.** Unlike standard UniswapV2 pools, these pools do not issue LP tokens on liquidity provision. WETH and token balances are sent directly to the pool and tracked through `reserve0`/`reserve1` updates via `sync()`.
- **Router-gated swaps.** The `swap()` function checks `msg.sender == router_address` and reverts for any other caller.
- **`reserve_residue`.** Both pools enforce a minimum residual liquidity (`reserve0_residue`, `reserve1_residue`) that cannot be drained. This prevents the pool from being fully emptied, maintaining price continuity.
- **Cumulative price oracles.** `price0CumulativeLast` and `price1CumulativeLast` are updated each time `_update()` runs, enabling TWAP (time-weighted average price) calculations by external integrators.
- **`sync()`** — Forces pool reserves to match current token balances. Called by RewardManager after liquidity provision, and by XSDStablecoin/BankXToken after pool burns.
- **`skim()`** — Transfers any token balance above current reserves to a specified address. Used for balance recovery.

---

## Fee Structure

| Pool | Swap Fee | Fee Implementation |
|---|---|---|
| `XSDWETHpool` | 0.2% | `balance0Adjusted = balance0 * 1000 - amount0In * 2` (2/1000 = 0.2% fee check) |
| `BankXWETHpool` | 0% | `balance0 * balance1 >= reserve0 * reserve1` (no deduction, fee-less) |

The XSDWETHpool fee is enforced in the `K` invariant check:
```solidity
uint balance0Adjusted = balance0 * 1000 - amount0In * 2;
uint balance1Adjusted = balance1 * 1000 - amount1In * 2;
require(balance0Adjusted * balance1Adjusted >= uint(_reserve0) * uint(_reserve1) * (1000**2));
```

---

## XSDWETHpool

### Token Pair

| Slot | Token |
|---|---|
| `reserve0` / `token0` | XSD |
| `reserve1` / `token1` | WETH |

### State Variables

| Variable | Type | Description |
|---|---|---|
| `XSDaddress` | `address` | XSD token |
| `WETHaddress` | `address` | WETH token |
| `smartcontract_owner` | `address` | Owner |
| `router_address` | `address` | Only address that can call `swap()` |
| `xsdamount` | `uint` | Tracks XSD input amount during swaps (for burn accounting) |
| `reserve0` | `uint112` | XSD reserves |
| `reserve1` | `uint112` | WETH reserves |
| `blockTimestampLast` | `uint32` | Timestamp of last reserve update |
| `price0CumulativeLast` | `uint` | Cumulative price of XSD in WETH |
| `price1CumulativeLast` | `uint` | Cumulative price of WETH in XSD |
| `kLast` | `uint` | Last `reserve0 * reserve1` snapshot |
| `reserve0_residue` | `uint` | Min XSD that must remain in pool |
| `reserve1_residue` | `uint` | Min WETH that must remain in pool |

### Functions

| Function | Access | Modifiers | Description |
|---|---|---|---|
| `getReserves()` | `public view` | None | Returns `(reserve0, reserve1, blockTimestampLast)`. |
| `collatDollarBalance()` | `public view` | None | USD value of WETH held: `WETH.balanceOf(this) * eth_usd_price / 1e6`. |
| `swap(uint amount0Out, uint amount1Out, address to)` | `external` | `lock` | Router-only. Executes constant-product swap with 0.2% fee check. |
| `sync()` | `external` | `lock` | Forces reserves to match balances. |
| `skim(address to)` | `external` | `lock` | Transfers excess tokens above reserves to `to`. |
| `setRouter(address)` | `external` | Owner only | Updates the router address. |
| `initialize(...)` | `public` | `initializer`, owner only | Sets token addresses, PID controller, router. One-time. |
| `resetAddresses(...)` | `external` | Owner only | Updates all contract references. |

### Events

| Event | When Emitted |
|---|---|
| `Swap(sender, amount0In, amount1In, amount0Out, amount1Out, to)` | `swap()` |
| `Sync(reserve0, reserve1)` | `_update()` (every state-changing call) |
| `Mint(sender, amount0, amount1)` | (Emitted but not triggered by current LP mechanism) |
| `Burn(sender, amount0, amount1, to)` | (Emitted but not triggered by current LP mechanism) |

---

## BankXWETHpool

### Token Pair

| Slot | Token |
|---|---|
| `reserve0` / `token0` | BankX |
| `reserve1` / `token1` | WETH |

### Fee Difference

The BankX/WETH pool uses a simpler K invariant — it does not apply any fee:
```solidity
require((balance0 * balance1) >= uint(_reserve0) * (_reserve1), 'BankXWETH: K');
```

This means swaps are fee-free. The economic incentive for liquidity providers comes from the BankX staking and reward system rather than swap fees.

### Notable Difference from XSDWETHpool

`BankXWETHpool` tracks `bankxamount` — the BankX input amount on XSD-to-WETH swaps — which is used by `BankXToken.burnpoolBankX()` for deflationary accounting. `XSDWETHpool` tracks `xsdamount` for the same reason.

---

## Security Considerations

- **`lock` modifier prevents reentrancy within pools.** Both pools use a `uint private unlocked = 1` mutex, equivalent to OpenZeppelin's `nonReentrant` guard. Note that `BankXWETHpool` also inherits `ReentrancyGuard` from OpenZeppelin, providing double protection.
- **Swap router restriction.** Only `router_address` can call `swap()`. Integrators cannot bypass the Router's circuit breakers by calling the pool directly.
- **`reserve_residue` protects against full drain.** Setting both residues to `0` would allow a swap to drain the pool entirely to the residue floor. Residues should be set to non-trivial amounts at deployment.
- **No LP token = no standard DEX composability.** These pools cannot be integrated with DEX aggregators or other DeFi protocols that expect ERC-20 LP tokens. Liquidity is managed entirely through the BankX Router/RewardManager system.
- **`sync()` is permissionless.** Anyone can call `sync()` to update reserves to match balances. This is used intentionally by the RewardManager after liquidity deposits, but it also means unexpected token transfers to the pool will be reflected in reserves on the next `sync()`.

---

## Integration Guide

```solidity
// Read XSD/WETH pool reserves for price calculation:
IXSDWETHpool pool = IXSDWETHpool(XSDWETH_POOL_ADDRESS);
(uint112 xsdReserve, uint112 wethReserve, ) = pool.getReserves();

// Spot XSD price in USD (1e6 precision):
uint256 ethPrice = XSD.eth_usd_price(); // from XSDStablecoin
uint256 xsdPriceVsEth = (uint256(xsdReserve) * 1e6) / uint256(wethReserve);
uint256 xsdPriceUsd = (ethPrice * 1e6) / xsdPriceVsEth;

// Note: always use the PID Controller's rolling average price for
// protocol-facing logic rather than the spot price:
uint256 xsdAvgPrice = IPIDController(PID_ADDRESS).xsd_updated_price();
```
