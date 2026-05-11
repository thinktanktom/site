# TreasuryPool

## Overview

TreasuryPool is the primary entry point for the AI DeFi system. It accepts ETH deposits from protocol participants, holds those funds in custody, and disburses ETH to approved function contracts (such as `XSDBuyBelowPeg`) when the Rules Engine authorises an action. All fund flows — deposit, withdrawal, and function-triggered disbursement — are protected by a transaction lock to prevent reentrancy.

TreasuryPool is deployed first in the AI DeFi deployment sequence. The Rules Engine address is set via a post-deployment setter rather than the constructor, so each contract can be upgraded independently.

---

## Key Concepts

- **Approved function contracts** — Only addresses registered via `setFunctionContract` can call `withdrawEthForFunction`. This gates all ETH disbursements to the automation layer.
- **Transaction lock** — A mutex applied to `deposit()` and `withdraw()` to prevent reentrancy attacks on fund flows.
- **ETH/USD price** — The pool reads the ETH/USD price via the PID Controller rather than a direct lower-level oracle call, keeping price sourcing consistent with the rest of the protocol.

---

## Architecture

TreasuryPool sits at the centre of the AI DeFi stack:

```
Depositors → TreasuryPool ← RulesEngine (set via setter)
                   │
                   ▼
          withdrawEthForFunction()
                   │
                   ▼
         XSDBuyBelowPeg (approved function)
                   │
                   ▼
            Router.swapETHForXSD()
```

---

## Core Functions

| Function | Access | Description |
|---|---|---|
| `deposit()` | Public, payable | Accepts ETH from a depositor. Protected by transaction lock. |
| `withdraw(uint256 amount)` | Owner or depositor | Returns ETH to the caller. Protected by transaction lock. |
| `withdrawEthForFunction(uint256 amount)` | Approved function contracts only | Disburses ETH to a registered function contract for execution. Gated by `_isApprovedFunction`. |
| `setRulesEngine(address)` | Owner | Sets the Rules Engine address post-deployment. |
| `setFunctionContract(address)` | Owner | Registers an approved function contract that may call `withdrawEthForFunction`. |

---

## Security Considerations

- **`_isApprovedFunction` check.** Every call to `withdrawEthForFunction` validates that `msg.sender` is a registered function contract. Unregistered addresses cannot withdraw ETH.
- **Transaction lock on deposit and withdrawal.** Both `deposit()` and `withdraw()` use a mutex to block reentrant calls. A call that re-enters before the lock is released will revert.
- **No constructor address binding.** The Rules Engine address is set via `setRulesEngine()` after deployment. This means TreasuryPool can be deployed before any other AI DeFi contract and wired up once the full system is live.
- **ETH price via PID Controller.** The contract reads ETH/USD pricing through `IPIDController` rather than calling a Chainlink feed directly. This keeps price access centralised and consistent with CollateralPool's oracle access pattern.
