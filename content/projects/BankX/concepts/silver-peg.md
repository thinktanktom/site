# Silver Peg

## Overview

XSD is pegged to **1/1000th of a troy ounce of silver (XAG)**. Its target price in USD is not fixed — it moves with the silver market. A user minting XSD today at a silver price of $25/oz receives XSD worth $0.025 per token. If silver rises to $30/oz, each XSD is worth $0.030.

This is a critical distinction from USD-pegged stablecoins. XSD is not a dollar stablecoin.

---

## Key Concepts

- **XAG** — The ticker symbol for silver in commodity markets, used by Chainlink's `XAG/USD` price feed.
- **Troy ounce** — A unit of mass equal to 31.1034768 grams, the standard for precious metals pricing.
- **XSD target price** — `xag_usd_price / 1000`, expressed in USD with 1e6 precision.
- **Gram price** — The per-gram silver price, derived as `(xag_usd_price * 1e4) / 311035`. This constant (`311035`) encodes troy oz in milligrams (31.1035 × 10,000) to preserve integer arithmetic precision.
- **PRICE_PRECISION** — `1e6` (6 decimal places). All price values in the protocol use this unit.

---

## How the Peg Price Is Calculated

The `XSDStablecoin` contract queries the `ChainlinkXAGUSDPriceConsumer` for the raw silver price in USD, then normalises it to 1e6 precision:

```solidity
function xag_usd_price() public view returns (uint256) {
    return (uint256(xag_usd_pricer.getLatestPrice()) * PRICE_PRECISION)
           / (uint256(10) ** xag_usd_pricer_decimals);
}
```

The XSD target price (used for collateral calculations throughout the system) is then:

```
xsd_target_price = xag_usd_price() / 1000
```

The PID Controller computes the silver gram price — used in interest accrual and collateral ratio math — as:

```solidity
uint256 silver_price = (XSD.xag_usd_price() * 1e4) / 311035;
// 311035 = 31.1035 (grams per troy oz) × 10000, preserving integer precision
```

---

## Why Silver, Not Dollars?

From the protocol's design rationale:

1. **Commodity anchor.** Silver has intrinsic value independent of any government or central bank. Pegging to silver rather than USD insulates XSD from dollar inflation over the long term.
2. **Scarcity and store of value.** Like gold, silver has a constrained global supply, making it a more defensible long-run unit of account than fiat.
3. **1/1000 denomination.** Dividing by 1000 produces a more practical token price in the current silver market (approximately $0.02–$0.04 per XSD at typical silver prices of $20–$40/oz), suitable for everyday transactions.

---

## Chainlink Oracle

| Feed | Network | Address |
|---|---|---|
| XAG/USD | Ethereum Mainnet | `0x379589227b15F1a12195D3f2d90bBc9F31f95235` |
| XAG/USD | Arbitrum | `0xC56765f04B248394CF1619D20dB8082Edbfa75b1` |
| XAG/USD | Polygon | `0x461c7B8D370a240DdB46B402748381C3210136b3` |
| XAG/USD | Optimism | `0x290dd71254874f0d4356443607cb8234958DEe49` |
| XAG/USD | Avalanche | `0x4305FB66699C3B2702D4d05CF36551390A4c69C6` |

The consumer validates oracle freshness by checking `answeredInRound >= roundID` before returning the price. If the oracle is stale, the call reverts.

---

## Security Considerations

- **USD price float.** Because XSD's USD value follows silver prices, integrators must not hardcode XSD as worth $1. Always read `XSD.xag_usd_price()` for the current target price.

Never treat XSD as equivalent to $1 USD in any integration. Its value is `xag_usd_price() / 1000` and will fluctuate with the silver market.

