# RulesEngine

## Overview

RulesEngine is the decision layer of AI DeFi. On each automation cycle it evaluates two on-chain conditions — is XSD below peg, and is XSD at peg — using live price data from the Chainlink XAG/USD feed and the BankX PID Controller. Based on the outcome, it calls the appropriate registered function contract: `XSDBuyBelowPeg` if XSD is below peg, or a liquidity-add function if XSD is at peg.

RulesEngine is deployed second in the AI DeFi sequence. Function contract addresses are set via post-deployment setters.

---

## Key Concepts

- **`pegThreshold`** — A tolerance band around the silver peg, expressed in basis points. If `pegThreshold = 100`, the tolerance band is ±1% of the silver price. Set by the contract owner.
- **`BASIS_POINTS`** — The precision denominator for threshold math (10,000 = 100%).
- **`HIGH_PRECISION`** — Internal price precision used for Chainlink-sourced silver prices (18 decimal places).
- **`PRICE_PRECISION`** — The 1e6 precision used by the BankX PID Controller for XSD prices.

---

## Architecture

```
AIDefiBroker → RulesEngine.evaluate()
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
  _checkXsdBelowPeg()   _checkXsdAtPeg()
  (Chainlink XAG/USD    (Chainlink XAG/USD
   + PID xsd_price)      + PID xsd_price)
          │                    │
          ▼                    ▼
   XSDBuyBelowPeg        AddLiquidity
   function contract     function contract
```

---

## Core Functions

| Function | Access | Description |
|---|---|---|
| `evaluate()` | TreasuryPool / Broker | Runs both peg checks and calls the appropriate registered function contract. Entry point for each automation cycle. |
| `getSilverPrice()` | Internal / public view | Returns the Chainlink XAG/USD price normalised to 18-decimal precision. |
| `_checkXsdBelowPeg()` | Internal | Returns `true` if XSD pool price is below the peg threshold. Emits `NumericalCheck`. |
| `_checkXsdAtPeg()` | Internal | Returns `true` if XSD pool price is within the upper and lower peg bounds. Emits `NumericalCheck`. |
| `setPegThreshold(uint256)` | Owner | Sets the basis-points tolerance band around the silver peg. |
| `setFunctionContract(address)` | Owner | Registers a function contract that RulesEngine is permitted to call. |

---

## Peg Check Logic

```solidity
function getSilverPrice() public view returns (uint256) {
    (int256 price) = ChainlinkXAGUSDPriceConsumer(silverUsdFeed).getLatestPrice();
    require(price > 0, "Rules Engine: Invalid Silver/USD price");
    uint8 decimals = ChainlinkXAGUSDPriceConsumer(silverUsdFeed).getDecimals();

    // Normalise to 18-decimal HIGH_PRECISION
    uint256 priceWithPrecision;
    if (decimals < 18) {
        priceWithPrecision = uint256(price) * (10 ** (18 - decimals));
    } else {
        priceWithPrecision = uint256(price) / (10 ** (decimals - 18));
    }
    return priceWithPrecision;
}

function _checkXsdBelowPeg() private returns (bool) {
    uint256 xsdPrice = IPIDController(bankxPidController).xsd_updated_price();
    xsdPrice = xsdPrice * (PRICE_PRECISION / 1e6); // align precision

    uint256 silverPrice = getSilverPrice();
    uint256 thresholdPrice = (silverPrice * (BASIS_POINTS - pegThreshold)) / BASIS_POINTS;

    emit NumericalCheck("XSD below peg check", xsdPrice, thresholdPrice, xsdPrice < thresholdPrice);
    return xsdPrice < thresholdPrice;
}

function _checkXsdAtPeg() private returns (bool) {
    uint256 xsdPrice = IPIDController(bankxPidController).xsd_updated_price();
    xsdPrice = xsdPrice * (PRICE_PRECISION / 1e6);

    uint256 silverPrice = getSilverPrice();
    uint256 lowerBound = (silverPrice * (BASIS_POINTS - pegThreshold)) / BASIS_POINTS;
    uint256 upperBound = (silverPrice * (BASIS_POINTS + pegThreshold)) / BASIS_POINTS;

    bool inRange = (xsdPrice >= lowerBound && xsdPrice <= upperBound);
    emit NumericalCheck("XSD at peg check", xsdPrice, silverPrice, inRange);
    return inRange;
}
```

---

## Events

| Event | Parameters | When emitted |
|---|---|---|
| `NumericalCheck` | `string label, uint256 value, uint256 reference, bool result` | On every peg check evaluation. Used for off-chain monitoring of each automation cycle. |

---

## Security Considerations

- **Function contract allowlist.** RulesEngine can only call addresses registered via `setFunctionContract`. Arbitrary external calls are not possible.
- **No fallback on stale oracle.** `getSilverPrice()` calls `require(price > 0)` but does not validate staleness independently — it relies on the Chainlink consumer's own staleness check (`answeredInRound >= roundID`). If the Chainlink feed is stale, the consumer reverts and `evaluate()` will revert with it.
- **`_extractRevertReason` removed.** An earlier version included a helper to decode revert reasons from failed function contract calls. This was removed due to prohibitive gas cost from fallback loops.

