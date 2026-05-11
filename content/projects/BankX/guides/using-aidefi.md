# Using AI DeFi

## Overview

AI DeFi is an autonomous peg-defence system built on top of BankX. Users deposit ETH into the TreasuryPool. An off-chain automation service then triggers evaluation cycles on a recurring schedule — when XSD is below its silver peg, the system automatically uses pooled ETH to buy XSD via the BankX Router, pushing the price back toward peg.

This guide covers the depositor flow: funding the TreasuryPool, how the automation operates, and withdrawing funds.

---

## Prerequisites

- ETH on one of the supported networks (Arbitrum, Ethereum, BSC, Base, Polygon, Optimism, Avalanche).
- A wallet with sufficient gas for the deposit transaction.
- The TreasuryPool contract address for your network — see [Deployments](/projects/BankX/deployments).

---

## Step 1 — Deposit ETH into TreasuryPool

Call `deposit()` on the TreasuryPool contract with the ETH amount you want to contribute:

```solidity
// Direct contract call (e.g. via Etherscan or a frontend)
TreasuryPool.deposit{value: depositAmountInWei}()
```

Using ethers.js:

```typescript
import { ethers } from "ethers";

const treasuryPool = new ethers.Contract(
  TREASURY_POOL_ADDRESS,
  ["function deposit() external payable"],
  signer
);

const depositAmount = ethers.parseEther("1.0"); // 1 ETH
const tx = await treasuryPool.deposit({ value: depositAmount });
await tx.wait();
```

Once the transaction confirms, your ETH is held in TreasuryPool and available for automated XSD purchases.

:::note
`deposit()` is protected by a transaction lock. Do not attempt to re-enter the function from within the same transaction — it will revert.
:::

---

## Step 2 — Automation Runs Automatically

After depositing, no further action is required. The off-chain automation service calls `AIDefiBroker.trigger()` on a recurring schedule. Each trigger runs the following cycle:

```
AIDefiBroker.trigger()
    │
    ▼
RulesEngine.evaluate()
    │
    ├── XSD < peg?  → XSDBuyBelowPeg pulls ETH from TreasuryPool
    │                  → swaps ETH for XSD via BankX Router
    │                  → XSD received held in TreasuryPool
    │
    ├── XSD at peg? → add liquidity to XSD/WETH pool
    │
    └── Neither?    → no-op; cycle ends without spending ETH
```

You can monitor automation activity by watching the `NumericalCheck` event emitted by RulesEngine on each cycle. It logs the XSD price, the silver peg threshold, and whether the condition was triggered.

---

## Step 3 — Withdraw ETH

To withdraw your ETH from TreasuryPool:

```solidity
TreasuryPool.withdraw(withdrawAmountInWei)
```

Using ethers.js:

```typescript
const withdrawAmount = ethers.parseEther("0.5"); // 0.5 ETH
const tx = await treasuryPool.withdraw(withdrawAmount);
await tx.wait();
```

:::note
`withdraw()` is also protected by a transaction lock. Withdrawals revert if called re-entrantly.
:::

---

## Monitoring Automation Activity

The easiest way to verify that AI DeFi is actively buying XSD is to inspect the `NumericalCheck` events on your chain's block explorer.

Each automation cycle emits events like:

| label | value | reference | result |
|---|---|---|---|
| `"XSD below peg check"` | XSD pool price | Silver peg threshold | `true` if buy triggered |
| `"XSD at peg check"` | XSD pool price | Silver price | `true` if in range |

If `result = true` on the `"XSD below peg check"` event, a buy was executed that cycle and ETH was consumed from TreasuryPool.

---

## Minimum Trade Size

A minimum trade size is enforced on XSD swaps to ensure each buy moves the price meaningfully. Trades below this minimum are rejected by the contract. Check the current minimum with the protocol admin or on-chain via the TreasuryPool settings.

---

## Frequently Asked Questions

**Does AI DeFi earn any yield on deposited ETH?**
No. Deposited ETH sits idle until a buy opportunity arises. The benefit is indirect — your ETH participates in XSD peg defence, which supports the value of XSD across the ecosystem.

**What happens to the XSD bought by the system?**
XSD purchased during a below-peg cycle is held in TreasuryPool. It is not automatically redistributed to depositors.

**Can my ETH be partially consumed?**
Yes. Each triggered buy consumes a portion of the TreasuryPool's ETH. The amount used per cycle depends on pool depth and the configured trade size.

**Which networks are supported?**
Arbitrum, Ethereum, BSC, Base, Polygon, Optimism, and Avalanche. See [Deployments](/projects/BankX/deployments) for contract addresses per chain.
