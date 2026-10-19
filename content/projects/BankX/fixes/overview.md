# Fix History

## Scope

This section is a record of **code-level defects found and fixed** in the BankX/XSD contract history, with the root cause and the before/after diff for each. It documents how the contracts described in the rest of this tree arrived at their current shape.

It is **not an incident report.** The items here span pre-launch development and post-launch hardening; no exploit, loss, or user impact is described or implied. Where an item says "impact if unfixed", that is an analysis of the defect's reach, not an account of something that happened.

The economic design — the peg mechanism, the two-wallet Sybil defence — is the founding team's. This section covers the contract-level fixes only.

**Repo stats:** 61 commits total, all mine. 17 are referenced across these pages by hash. The contract repository is private, so hashes appear as plain references rather than links.

---

## Index

| # | Date closed | Commit(s) | File(s) | Category | Page |
|---|---|---|---|---|---|
| 1 | 2024-06-22 | `8d0bb4b` | `RewardManager.sol` | confused deputy | [Access Control & Principal Confusion](/projects/BankX/fixes/access-and-principals) |
| 2 | 2024-09-15 | `3264a85` | `XSDStablecoin.sol` | fixed-point math | [Fixed-Point & Unit Errors](/projects/BankX/fixes/fixed-point-and-units) |
| 3 | 2024-11-01 | `e6e5b1d`, `42e7683`, `c4f139f` | `PIDController.sol` | underflow / liveness | [Liveness & Oracle Design](/projects/BankX/fixes/liveness-and-oracles) |
| 4 | 2024-11-21 | `7a15bae`, `fd516b4` | `CollateralPool.sol` | settlement risk | [Fixed-Point & Unit Errors](/projects/BankX/fixes/fixed-point-and-units) |
| 5 | 2024-12-31 | `abb17d6` | `CollateralPool.sol` | unit mismatch | [Fixed-Point & Unit Errors](/projects/BankX/fixes/fixed-point-and-units) |
| 6 | 2025-02-27 | `c8a2611`, `ccc5b20`, `2a7a3f1` | `Router.sol` | reentrancy / access | [Access Control & Principal Confusion](/projects/BankX/fixes/access-and-principals) |
| 7 | 2025-03-31 | `1aead3d`, `7d3f5c6`, `a1f89b4` | `PIDController.sol` | oracle design (TWAP) | [Liveness & Oracle Design](/projects/BankX/fixes/liveness-and-oracles) |

Items 4 and 5 are filed under unit errors rather than under their contract: both are cases of a quantity being tracked or compared in the wrong denomination, which is the same failure as item 2 even though the symptom differs.

---

## Minor Items

### `08a6001` (2024-06-05): `CollateralPoolLibrary` visibility, `internal` → `public`

The commit message ("Collateral Pool Library visibility modified") does not state a reason, and no comment appears in the diff. The standard technical effect of the change: `public`/`external` library functions can be deployed once and linked externally instead of being inlined into every caller's bytecode, which matters when a contract's own bytecode approaches the 24 KB EIP-170 limit.

Whether that was the motivation here is **not something the repo settles.** No `libraries: {...}` linking block exists in `hardhat.config.js`, and no deploy script references `CollateralPoolLibrary` for external linking — only test files do. Recorded as an open question rather than an explained change.

The silver-peg conversion constant (`24f4b07`) is also a minor item, but it is a unit error and is documented with the others on [Fixed-Point & Unit Errors](/projects/BankX/fixes/fixed-point-and-units).
