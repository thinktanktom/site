# Bonding Curve

## Overview

`BondingCurve` is a small, stateless contract: four `pure` functions and two `immutable` constants. It holds no token balances and no per-token state — every `Bag` clone calls into the same deployed `BondingCurve` instance, passing in its own `totalSupply()` as the curve position. That's what lets one `BondingCurve` deployment serve every token the factory ever creates.

---

## The Curve

```solidity
// y = A*e^(Bx)
uint256 public immutable A = 1060848709;
uint256 public immutable B = 4379701787;
```

The curve models price as an exponential function of supply sold. All math is done in fixed-point "wad" (1e18-scaled) arithmetic using Solady's `FixedPointMathLib` — `mulWad`, `expWad`, `lnWad`, `divWad`, and `fullMulDiv` — rather than a floating-point or lookup-table approximation. `expWad`/`lnWad` give the contract genuine `e^x` and `ln(x)` evaluation on-chain, which is what makes a smooth exponential curve (versus a simpler linear or constant-product one) tractable in Solidity without external oracles.

---

## The Four Quotes

| Function | Given | Returns |
|---|---|---|
| `getEthBuyQuote(currentSupply, ethOrderSize)` | ETH being spent | tokens received |
| `getEthSellQuote(currentSupply, ethOrderSize)` | ETH desired | tokens that must be sold |
| `getTokenBuyQuote(currentSupply, tokenOrderSize)` | tokens desired | ETH cost |
| `getTokenSellQuote(currentSupply, tokensToSell)` | tokens being sold | ETH received |

`Bag.buy()` and `Bag.sell()` call the ETH-denominated and token-denominated variants respectively, then apply the protocol fee on top of (or ahead of, depending on direction) the raw curve quote. `getTokenSellQuote` additionally guards against `currentSupply < tokensToSell` with an explicit `InsufficientLiquidity` revert, since selling more tokens than exist would otherwise underflow `x0 - tokensToSell`.

---

## Design Note

An exponential bonding curve with this exact shape — small constant-product-style buy/sell quotes computed via `expWad`/`lnWad`, paired with a hard-coded "primary supply" cutover that triggers migration into a Uniswap V3 pool — is the same general pattern used by other creator/agent-token-launch protocols in the Base/Zora ecosystem for pricing tokens before they have enough liquidity to support a real AMM pool. The suite adapts that general architecture (bonding curve → graduation → AMM) for the Based Agents use case rather than inventing a new curve shape from scratch, which is a reasonable choice: the math has seen real-world usage and the failure modes (curve exhaustion, graduation math, fee-on-transfer edge cases) are well understood.
