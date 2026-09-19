# Bag Token

## Overview

`Bag.sol` is the per-agent ERC-20 token — the contract the factory clones on every launch. It's an `ERC20VotesUpgradeable` + `OwnableUpgradeable` + `ReentrancyGuardUpgradeable` contract that implements the `IBag` interface, and it's the largest and most involved contract in the suite: it owns both trading modes (bonding curve and Uniswap V3), the graduation transition between them, and the fee dispersal on every trade.

Its constructor sets five addresses as `immutable` on the shared implementation — `protocolFeeRecipient`, `protocolRewards`, `WETH`, `nonfungiblePositionManager`, and `swapRouter` — once, at implementation-deploy time. Every cloned instance shares these; only `initialize()` parameters differ per token.

---

## Initialization

`initialize()` runs once per clone (guarded by OpenZeppelin's `initializer` modifier) and sets the token's economics as **storage** variables, not constants — a deliberate choice, since `upgradeParameters()` (below) needs to be able to change them later:

| Parameter | Initial Value |
|---|---|
| `MAX_TOTAL_SUPPLY` | 1,000,000,000e18 |
| `PRIMARY_MARKET_SUPPLY` | 800,000,000e18 (sold via the bonding curve) |
| `SECONDARY_MARKET_SUPPLY` | 200,000,000e18 (minted at graduation, into the Uniswap V3 pool) |
| `TOTAL_FEE_BPS` | 100 (1%) |
| `TOKEN_CREATOR_FEE_BPS` / `PROTOCOL_FEE_BPS` / `PLATFORM_REFERRER_FEE_BPS` / `ORDER_REFERRER_FEE_BPS` | 5000 / 2000 / 1500 / 1500 (of the 1% — i.e. 50/20/15/15 split) |
| `MIN_ORDER_SIZE` | 0.0000001 ether |
| `graduationFee` | 0.1 ether |

`initialize()` also calls `createAndInitializePoolIfNecessary` on the Uniswap V3 position manager immediately — the pool exists from block one, just unfunded and untradeable until graduation — and, if the creator sent ETH along with the launch transaction, executes an initial bonding-curve buy in the same call.

---

## Trading: `buy()` / `sell()`

Both functions take an `expectedMarketType` parameter that must match the token's current `marketType`, reverting with `InvalidMarketType` otherwise — a guard against a transaction being mined after the market has already graduated out from under the caller's expectations.

- **Bonding curve mode**: `buy()` mints tokens directly (`_mint`) after computing the quote via `BondingCurve.getEthBuyQuote`; `sell()` burns tokens and pays out ETH via `BondingCurve.getTokenSellQuote`.
- **Uniswap V3 mode**: `buy()`/`sell()` wrap/unwrap ETH↔WETH and route through `ISwapRouter.exactInputSingle` against the graduated pool instead of the internal curve.

Every buy and sell disperses its fee through `ProtocolRewards.depositBatch()` (see [Protocol Rewards](/projects/BasedAgents/contracts/protocol-rewards)), and both emit superset events (`BagTokenBuy`, `BagTokenSell`) carrying the full trade context — sender, recipient, referrer, fee, resulting balance, comment, and post-trade total supply — useful for indexing trade history off-chain without replaying state.

---

## Graduation

`_validateBondingCurveBuy()` recomputes the order against `PRIMARY_MARKET_SUPPLY - totalSupply()` on every bonding-curve buy. If the requested order would meet or exceed the remaining primary supply, it clamps the order to exactly what's left, recalculates the true ETH cost and fee for that clamped amount, refunds any excess ETH the buyer sent, and sets a `startMarket` flag — which `buy()` then uses to call `_graduateMarket()` in the same transaction:

1. Flips `marketType` to `UNISWAP_POOL` (permanent — there's no path back to bonding-curve mode).
2. Pays the `graduationFee` (0.1 ETH default) into `ProtocolRewards`.
3. Wraps the curve's entire accumulated ETH balance into WETH.
4. Mints the 200M `SECONDARY_MARKET_SUPPLY` to itself.
5. If the pool's current spot price doesn't match the token's pre-set `POOL_SQRT_PRICE_X96` constant, executes a small swap to correct it.
6. Mints a full-range Uniswap V3 LP position (ticks `-887200` to `887200`) — **to the token creator**, not to the protocol or to the contract itself.

That last point is worth calling out explicitly: once a token graduates, its creator receives the LP position outright, meaning they also receive any future swap fees that position accrues. The contract itself never custodies the graduated liquidity.

---

## The Owner Escape Hatch

```solidity
function upgradeParameters(
    uint256 _MAX_TOTAL_SUPPLY, uint256 _PRIMARY_MARKET_SUPPLY, uint256 _SECONDARY_MARKET_SUPPLY,
    uint256 _TOTAL_FEE_BPS, uint256 _TOKEN_CREATOR_FEE_BPS, uint256 _PROTOCOL_FEE_BPS,
    uint256 _PLATFORM_REFERRER_FEE_BPS, uint256 _ORDER_REFERRER_FEE_BPS,
    uint256 _MIN_ORDER_SIZE, uint256 _graduationFee
) external onlyOwner { ... }
```

`Ownable`'s owner is set to `tokenCreator` at `initialize()`. This function lets that creator rewrite every economic constant on an already-live (and possibly already-graduated) token at any time — supply caps, the primary/secondary split, every fee basis point, the minimum order size, and the graduation fee. See [Access Control](/projects/BasedAgents/security/access-control) for why this is a real centralization point worth knowing about before trusting a given token's published tokenomics.

---

## A Second, Unrelated "Bag Token"

The repository also contains `BagToken.sol`, defining a contract named `BAGToken` — and it is **not** the same thing as `Bag.sol` above, despite the similar name. `BAGToken` is a much simpler, standalone `ERC20VotesUpgradeable` + `UUPSUpgradeable` contract that mints a fixed supply of exactly 1,000,000,000 tokens to a specified owner at `initialize()` and can be upgraded by that same owner. It isn't referenced by `BagFactoryImpl.deploy()` or by any other contract in the suite — it appears to be a separate, standalone governance/utility token (plausibly for the platform itself, as distinct from the per-agent tokens the factory mints) rather than something end users interact with through the factory flow documented on this page.
