# Based Agents Smart Contract Suite — Introduction

## Overview

Based Agents is a protocol for launching agent-owned ERC-20 tokens that start trading immediately against an internal bonding curve, then "graduate" into a real Uniswap V3 market once enough of the token has been bought. I was brought on as a freelance engineer (sourced via Upwork, mid-2024 through early 2025) to build and deploy the on-chain half of the protocol: the [public repository](https://github.com/BasedAgents/smart-contracts) contains the full Hardhat project — contracts, Hardhat/Foundry-style tests run against a forked mainnet, and the deployment scripts used to ship the suite to Sepolia.

---

## The Contracts

| Contract | File | Role |
|---|---|---|
| **ProtocolRewards** | `ProtocolRewards.sol` | Permissionless ETH escrow. Every fee split lands here; recipients pull their own balance, including via a gasless EIP-712 signature path. |
| **BondingCurve** | `BondingCurve.sol` | Stateless pricing math. Implements an exponential `y = A·e^(Bx)` curve shared by every token. |
| **Bag** | `Bag.sol` | The per-agent ERC-20 token. Trades against the bonding curve, then graduates to a Uniswap V3 pool. |
| **BagToken** | `BagToken.sol` | A separate, simpler fixed-supply (1,000,000,000) upgradeable governance token — distinct from the per-agent `Bag` clones (see the [Bag Token](/projects/BasedAgents/contracts/bag-token) page for the distinction). |
| **BagFactory / BagFactoryImpl** | `BagFactory.sol`, `BagFactoryImpl.sol` | An upgradeable (UUPS) factory. Its single `deploy()` entry point clones a new `Bag` token and `BagGovernor` per launch. |
| **BagGovernor / BagGovernorImpl** | `BagGovernor.sol`, `BagGovernorImpl.sol` | An OpenZeppelin `Governor` stack scoped to one token, with proposal rights restricted to that token's creator. |

All six of these are deployed and verified on Sepolia; addresses are listed in the repository's README.

---

## Testing Approach

The test suite (`tests/amendment_tests.js`, `tests/market_graduation_tests.js`) runs against Hardhat's built-in network configured to fork live mainnet state (`hardhat.config.js` sets `networks.hardhat.forking.url` to a mainnet RPC endpoint supplied via a gitignored `secret.json`). That means the tests deploy the suite fresh into a forked mainnet and then trade against the **real** WETH contract and the **real** Uniswap V3 `NonfungiblePositionManager` and swap router — not mocks — so the bonding-curve-to-Uniswap-V3 graduation path is exercised against the actual contracts it will interact with in production. See [Mainnet Fork Tests](/projects/BasedAgents/testing/mainnet-fork) for the specifics.

---

## Scope

This documentation covers the six contracts above, how they compose into the deploy → trade → graduate lifecycle, the test suite that backs that lifecycle, and the access-control model across the suite. It does not cover the off-chain agent orchestration layer that calls into these contracts — that's a separate system outside this repository.
