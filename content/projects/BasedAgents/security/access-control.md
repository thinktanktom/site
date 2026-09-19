# Access Control

## Overview

There's no single access-control scheme across the suite — each contract picks the pattern that fits its role. This page walks through who can do what, contract by contract.

---

## Ownership Patterns

| Contract | Pattern | Owner set to |
|---|---|---|
| `Bag` | `OwnableUpgradeable`, no UUPS (not itself upgradeable as a proxy — clones are immutable bytecode) | `tokenCreator`, at `initialize()` |
| `BagFactoryImpl` | `OwnableUpgradeable` + `UUPSUpgradeable` | Whoever is passed to `initialize(address _owner)` — the protocol deployer |
| `BagGovernorImpl` | `OwnableUpgradeable` + `UUPSUpgradeable` | `_tokenCreator`, at `initialize()` |
| `BagGovernor` | `OwnableUpgradeable`, no UUPS | Not explicitly set via `Ownable`'s constructor path in the initializer shown in the contract — governance-parameter updates are `onlyOwner`-gated, proposal rights are gated separately (see below) |
| `ProtocolRewards` | None — no `Ownable`, no admin functions at all | N/A |
| `BondingCurve` | None — stateless, pure-function contract | N/A |

Each `_authorizeUpgrade` (in `BagFactoryImpl` and `BagGovernorImpl`) is `onlyOwner`, the standard UUPS pattern.

---

## The Token Creator Controls Their Own Token's Economics

`Bag.upgradeParameters()` is `onlyOwner`, and `Ownable`'s owner is the `tokenCreator` set once at `initialize()`. That means the person who launches a token — not the protocol operator — can rewrite its `MAX_TOTAL_SUPPLY`, the primary/secondary market split, every fee basis point, `MIN_ORDER_SIZE`, and `graduationFee` at any point after launch, including after the token has already graduated to a public Uniswap V3 market. This is documented behavior, not a bug, but it's the single biggest centralization point in the suite: nothing on-chain prevents a creator from changing the economics buyers thought they were trading against. A holder's only real protections are transparency (the change is a public, logged transaction — `TokenParametersUpdated` / `GraduationFeeUpdated` events fire) and whatever off-chain trust or reputation the token creator has.

---

## Restricted Governance Proposals

Both `BagGovernor` and `BagGovernorImpl` restrict `propose()` to a single stored address (`proposer` / `tokenCreator` respectively) — a deliberate, more centralized variant of OpenZeppelin's standard `Governor`, where normally anyone above `proposalThreshold` can propose. Voting itself is unrestricted and follows standard `ERC20Votes` weight.

---

## Permissionless by Design

Two parts of the suite are intentionally open to anyone, and that's a feature rather than an oversight:

- **`BagFactoryImpl.deploy()`** — anyone can launch a token. Only upgrading the factory's own implementation is owner-gated.
- **`ProtocolRewards`** — anyone can deposit for anyone; only the balance holder (or someone holding a valid signature from them) can move funds out. No admin key can freeze or redirect a balance.

---

## Deployment Status

Per the repository's README, all six contracts (`ProtocolRewards`, `BondingCurve`, `Bag`, `BagGovernance`, the `BagFactory` implementation, and the `BagFactory` proxy) are deployed and verified on the Sepolia testnet.
