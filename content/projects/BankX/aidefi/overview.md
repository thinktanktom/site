# AI DeFi

## Overview

AI DeFi is an autonomous on-chain automation layer built on top of BankX. It monitors the XSD market price relative to the silver peg and executes corrective actions — buying XSD when below peg, adding liquidity when at peg — using ETH deposited into a shared Treasury Pool.

The system operates without human intervention: an off-chain automation service calls the AI DeFi Broker on a recurring schedule, the Rules Engine evaluates on-chain price conditions using Chainlink and the PID Controller, and — if a condition is met — the appropriate function contract executes via the BankX Router.

---

## Contract Architecture

AI DeFi consists of four contracts deployed per chain:

| Contract | Deployed | Role |
|---|---|---|
| `TreasuryPool` | 1st | Accepts ETH deposits, manages protocol funds, orchestrates calls to the Rules Engine and function contracts. Primary entry point for depositors and the automation service. |
| `RulesEngine` | 2nd | Evaluates on-chain conditions using Chainlink price feeds and the PID Controller. Determines whether XSD is below peg or at peg and triggers the corresponding function contract. |
| `XSDBuyBelowPeg` | 3rd | Executes swaps of ETH for XSD via the BankX Router when XSD is below peg. Uses inline assembly to extract the XSD amount received from the Router's low-level return data. |
| `AIDefiBroker` | 3rd | Entry point for off-chain automation. Coordinates trigger calls into the TreasuryPool and RulesEngine. |

Cross-contract addresses (e.g. the RulesEngine address in TreasuryPool) are set via setter functions after deployment rather than hardcoded in constructors. This allows each contract to be upgraded or replaced independently.

---

## System Flow

```
Off-chain automation → AIDefiBroker.trigger()
          │
          ▼
    RulesEngine.evaluate()
    ┌────────────────────────────────────────────┐
    │  XSD < peg?  → call XSDBuyBelowPeg         │
    │  XSD at peg? → add liquidity to XSD pool    │
    │  Neither?    → no-op                        │
    └────────────────────────────────────────────┘
          │
          ▼
  XSDBuyBelowPeg.execute()
  Sends ETH from TreasuryPool → Router.swapETHForXSD()
  XSD received → held in TreasuryPool
```

---

## Peg Detection Logic

The Rules Engine fetches the XAG/USD silver price from Chainlink and compares it against the XSD pool price from the PID Controller. Two conditions are checked on every evaluation:

```solidity
function _checkXsdBelowPeg() private returns (bool) {
    uint256 xsdPrice = IPIDController(bankxPidController).xsd_updated_price();
    xsdPrice = xsdPrice * (PRICE_PRECISION / 1e6);

    uint256 silverPrice = getSilverPrice(); // Chainlink XAG/USD, 18-decimal precision
    uint256 thresholdPrice = (silverPrice * (BASIS_POINTS - pegThreshold)) / BASIS_POINTS;

    return xsdPrice < thresholdPrice;
}

function _checkXsdAtPeg() private returns (bool) {
    uint256 xsdPrice = IPIDController(bankxPidController).xsd_updated_price();
    xsdPrice = xsdPrice * (PRICE_PRECISION / 1e6);

    uint256 silverPrice = getSilverPrice();
    uint256 lowerBound = (silverPrice * (BASIS_POINTS - pegThreshold)) / BASIS_POINTS;
    uint256 upperBound = (silverPrice * (BASIS_POINTS + pegThreshold)) / BASIS_POINTS;

    return (xsdPrice >= lowerBound && xsdPrice <= upperBound);
}
```

`pegThreshold` is set in basis points by the contract owner and defines the tolerance band around the silver peg.

---

## XSD Buy Execution

When `_checkXsdBelowPeg()` returns true, `XSDBuyBelowPeg` requests ETH from the TreasuryPool and calls the BankX Router's `swapETHForXSD`. The XSD amount received is extracted from the low-level call return data using inline assembly:

```solidity
// Extract the XSD amount from the router's return data
if (data.length >= 32) {
    assembly {
        xsdAmount := mload(add(data, 32))
        // add(data, 32): skip the ABI length prefix
        // mload: load 32 bytes (one uint256) from that position
    }
}
require(xsdAmount > 0, "XSDBuyBelowPeg: No XSD received");
```

This is more gas-efficient than `abi.decode()` for a single `uint256` return value.

---

## Security Considerations

- **Transaction lock on deposit and withdrawal.** TreasuryPool enforces a transaction lock on `deposit()` and `withdraw()` to prevent reentrancy.
- **Approved function gating.** Only function contracts registered via the RulesEngine's setter function can be invoked. The setter is callable post-deployment so contracts can be rotated without a full redeployment.
- **No constructor address binding.** TreasuryPool, RulesEngine, and XSDBuyBelowPeg each expose setter functions for their cross-contract dependencies. This means any individual contract can be upgraded independently.
- **`_isApprovedFunction` check.** The TreasuryPool validates that only approved function contracts can withdraw ETH for execution.

---

## Deployments

AI DeFi is deployed on each supported network alongside the BankX protocol. See [Deployments](/projects/BankX/deployments) for contract addresses per chain.
