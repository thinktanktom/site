# BankX Protocol — Introduction

## Overview

BankX is a fractional-algorithmic stablecoin protocol built on Ethereum. It issues **XSD**, a stablecoin pegged to **1/1000th of a troy ounce of silver (XAG)**, and **BankX**, a utility and governance token used as partial collateral, for buybacks, and to distribute protocol rewards.

The protocol draws inspiration from FRAX's fractional-algorithmic model: at full collateralisation (CR = 100%), every XSD is backed by WETH. As the protocol grows and the BankX market cap strengthens relative to XSD supply, the collateral ratio falls — meaning a portion of XSD is backed by BankX instead of WETH, reducing capital requirements for minters while maintaining solvency.

XSD is **not** a dollar stablecoin. Its target price in USD tracks the silver market in real time via Chainlink's `XAG/USD` price feed divided by 1000.

Built on top of the core protocol is **AI DeFi** — an autonomous on-chain automation layer that monitors XSD's market price and executes corrective trades when XSD drifts below peg, using ETH deposited into a shared TreasuryPool.

---

## Core Design Principles

- **Silver peg, not dollar peg.** XSD targets 1/1000 troy oz of silver (XAG/1000), giving it commodity backing rather than arbitrary fiat pegging.
- **No liquidations.** Minters of XSD are never liquidated. Their collateral cannot be seized. This is a deliberate product decision that differentiates BankX from over-collateralised protocols like DAI or Liquity.
- **Individual Created Digital Currency (ICDC).** Any user can deposit collateral, mint XSD, earn interest, and redeem at will — without a bank or intermediary in the loop.
- **Protocol-Owned Liquidity (POL).** The protocol actively manages liquidity depth in both the XSD/WETH and BankX/WETH AMM pools via a deficit-and-reward system coordinated by the PID Controller and RewardManager.
- **Algorithmic stability with a circuit breaker.** The PID Controller adjusts the collateral ratio in 0.25% steps (xsd_step = 2500 in 1e6 precision) and enforces a block delay between all minting, redeeming, and swapping actions to block flash-loan attacks.

---

## Token Summary

| Token | Type | Peg | Role |
|---|---|---|---|
| XSD | ERC-20 stablecoin | XAG/1000 (silver) | Mint, redeem, medium of exchange |
| BankX | ERC-20 utility token | None (market-priced) | Fractional collateral, buybacks, LP rewards |

---

## Contract Inventory

| Contract | Role |
|---|---|
| `XSDStablecoin` | ERC-20 XSD; pool registry; oracle price queries; CR authority |
| `BankXToken` | ERC-20 BankX; pool-gated mint/burn |
| `CollateralPool` | Core vault: mint/redeem XSD, interest accrual, buyback/burn |
| `PIDController` | CR adjustment; deficit buckets; price checks; rolling price average |
| `RewardManager` | Tiered liquidity rewards (vesting); deficit-triggered liquidity provision |
| `Router` | UniswapV2-fork router with circuit breakers; swap/liquidity entrypoint |
| `XSDWETHpool` | AMM pool: XSD ↔ WETH (0.2% swap fee) |
| `BankXWETHpool` | AMM pool: BankX ↔ WETH (no swap fee; fee-less design) |
| `CollateralPoolLibrary` | Pure math: mint interest, redemption interest, buyback calculations |
| `BankXLibrary` | Pure AMM math: quote function |
| `ChainlinkETHUSDPriceConsumer` | Chainlink ETH/USD price feed wrapper |
| `ChainlinkXAGUSDPriceConsumer` | Chainlink XAG/USD (silver) price feed wrapper |
| `ERC20Custom` | Base ERC-20 extended with `_burnFrom` and pool-aware hooks |

**AI DeFi contracts** (autonomous peg-defence layer):

| Contract | Role |
|---|---|
| `TreasuryPool` | Holds deposited ETH; disburses funds to approved function contracts |
| `RulesEngine` | Evaluates XSD peg status using Chainlink + PID Controller; triggers action |
| `XSDBuyBelowPeg` | Swaps ETH for XSD via the Router when XSD is below peg |
| `AIDefiBroker` | Public automation entry point; called by off-chain scheduler |

---

## System Flow (Simplified)

```
User deposits ETH
       │
       ▼
  CollateralPool
  ┌────────────────────────────────────────────┐
  │  CR = 100%? → mint1t1XSD (WETH only)       │
  │  0 < CR < 100%? → mintFractionalXSD        │
  │                   (WETH + BankX burned)    │
  │  CR = 0%? → mintAlgorithmicXSD             │
  │             (BankX only)                   │
  └────────────────────────────────────────────┘
       │
       ▼
  XSD minted to user
  Interest accrues per block
       │
       ▼
  User redeems XSD
  Receives WETH + BankX (at current CR)
  + accrued interest paid in BankX
  ```


---

## Precision and Units

All ratio and price variables use `1e6` (6-decimal) precision unless stated otherwise.

| Value | Encoded as | Meaning |
|---|---|---|
| CR = 100% | `1000000` | Fully collateralised |
| CR = 85% | `850000` | 85% WETH, 15% BankX |
| Price = $1.00 | `1000000` | $1.00 in 1e6 units |
| Interest rate 5.28% | `52800` | Annual rate in 1e6 units |
| xsd_step 0.25% | `2500` | CR step size in 1e6 units |

Token amounts use `1e18` (18-decimal) precision, matching the ERC-20 standard for both XSD and BankX.

