# AIDefiBroker

## Overview

AIDefiBroker is the automation entry point for the AI DeFi system. Off-chain automation services call it on a recurring schedule to trigger an evaluation cycle. The Broker forwards the call to TreasuryPool and RulesEngine, which evaluate on-chain conditions and execute the appropriate action.

By exposing a single callable surface to off-chain systems, AIDefiBroker simplifies the automation interface — the off-chain service only needs the Broker address and does not need to orchestrate calls to multiple contracts directly.

---

## Architecture

```
Off-chain automation service
          │
          ▼
   AIDefiBroker.trigger()
          │
          ▼
   RulesEngine.evaluate()
       ┌───┴────────────────┐
       ▼                    ▼
 XSDBuyBelowPeg     AddLiquidity
 (if below peg)     (if at peg)
```

---

## Core Functions

| Function | Access | Description |
|---|---|---|
| `trigger()` | Public (called by automation service) | Initiates an AI DeFi evaluation cycle. Calls into the Rules Engine to assess XSD peg status and execute the appropriate function. |
| `setRulesEngine(address)` | Owner | Sets the Rules Engine address. |
| `setTreasuryPool(address)` | Owner | Sets the TreasuryPool address. |

---

## Deployment

AIDefiBroker is deployed alongside XSDBuyBelowPeg in the final step of the AI DeFi deployment sequence, after TreasuryPool and RulesEngine are already deployed and configured. Cross-contract addresses are wired up via setter functions. See [Deployments](/projects/BankX/deployments) for per-chain contract addresses.

---

## Integration

To trigger AI DeFi from an off-chain service:

```typescript
import { ethers } from "ethers";

const broker = new ethers.Contract(
  AIDEFI_BROKER_ADDRESS,
  ["function trigger() external"],
  signer
);

// Called on a schedule (e.g. every N minutes) by the automation service
await broker.trigger();
```

The automation service is responsible for:
- Calling `trigger()` on a recurring interval.
- Ensuring sufficient ETH is held in TreasuryPool for buy operations.
- Monitoring the `NumericalCheck` events emitted by RulesEngine to confirm each cycle's outcome.

---