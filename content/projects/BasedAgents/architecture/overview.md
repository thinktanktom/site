# Architecture Overview

## The Deploy → Trade → Graduate Lifecycle

Every Based Agents token goes through the same three phases, all enforced on-chain by the `Bag` contract itself:

```
1. DEPLOY     BagFactoryImpl.deploy() clones a Bag + a BagGovernor,
              initializes the Bag in MarketType.BONDING_CURVE,
              and pre-creates (but does not yet fund) a Uniswap V3 pool.

2. TRADE      buy()/sell() price against BondingCurve.sol
              (y = A·e^(Bx)) using the token's own totalSupply()
              as the curve position. Fees flow to ProtocolRewards.

3. GRADUATE   The moment cumulative buys exhaust the 800M-token
              primary allocation, the same buy() transaction
              mints the 200M secondary allocation, wraps the
              curve's accumulated ETH into WETH, aligns the pool's
              spot price, and mints a full-range Uniswap V3 LP
              position directly to the token creator. MarketType
              flips to UNISWAP_POOL permanently.
```

There is no separate "launch to DEX" transaction and no off-chain coordination required for graduation — it happens atomically inside whichever `buy()` call crosses the supply threshold.

---

## Deterministic Clone Deployment

`BagFactoryImpl` does not deploy a fresh `Bag` and `BagGovernor` contract from scratch on every call to `deploy()`. Instead it holds three **immutable** addresses set once at its own construction — `tokenImplementation`, `governorImplementation`, and `bondingCurve` — and uses OpenZeppelin's `Clones.cloneDeterministic` to deploy minimal-proxy (EIP-1167) clones of the first two, salted from:

- the caller's address (`msg.sender`)
- the intended token creator's address
- a hash of the token's URI
- `block.coinbase`, `block.number`, `block.prevrandao`, `block.timestamp`, `tx.gasprice`, `tx.origin`

Every `Bag` token on the protocol therefore runs byte-identical logic — only its `initialize()` call parameters (name, symbol, creator, platform referrer, token URI) differ. This keeps per-launch gas costs low and means an audit of the shared implementation covers every token that will ever be cloned from it.

---

## Fee Flow

Every buy and sell carries a 1% total fee, split four ways in basis points: 50% to the token creator, 20% to the protocol, 15% to a platform referrer, and 15% to whoever referred the specific order. Rather than pushing four separate ETH transfers on every trade — where a single malicious or broken recipient contract could revert and brick trading — `Bag._disperseFees()` calls `ProtocolRewards.depositBatch()` once, crediting all four balances in a single external call. Each recipient later withdraws their own balance from `ProtocolRewards` on their own schedule, including via a gasless, EIP-712-signed `withdrawWithSig` path that lets a relayer submit the withdrawal transaction on the balance holder's behalf.

---

## Component Map

```
BagFactoryImpl (UUPS proxy, owner-upgradeable)
 ├─ clones ──> Bag                (per-token: bonding curve + AMM + votes)
 │              ├─ reads ───────> BondingCurve   (shared pricing math)
 │              ├─ pays fees ───> ProtocolRewards (shared escrow)
 │              └─ graduates ───> Uniswap V3 pool (per-token)
 └─ clones ──> BagGovernor        (per-token: proposal + voting)
                └─ reads votes ─> Bag (ERC20Votes balance of the same token)
```

`BondingCurve` and `ProtocolRewards` are each deployed once and shared by every `Bag` clone; `Bag` and `BagGovernor` are cloned fresh per token launch.
