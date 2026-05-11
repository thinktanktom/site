# Oracles: Chainlink Price Consumers

## Overview

BankX uses two Chainlink price feed consumer contracts: `ChainlinkETHUSDPriceConsumer` (ETH/USD) and `ChainlinkXAGUSDPriceConsumer` (XAG/USD silver). Both are thin wrappers around Chainlink's `AggregatorV3Interface`, implementing freshness validation via the `answeredInRound >= roundID` staleness check. Prices are pulled into `XSDStablecoin` and normalised to 1e6 precision.

---

## ChainlinkETHUSDPriceConsumer

### Purpose

Provides the ETH/USD price used throughout the protocol for:
- Converting WETH collateral amounts to USD value in `CollateralPool`.
- Computing pool-based BankX and XSD prices in `PIDController`.
- ETH value calculations in `RewardManager`.

### Contract Details

| Property | Value |
|---|---|
| Mainnet feed address (hardcoded) | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` |
| Interface | `AggregatorV3Interface` |
| Freshness check | `answeredInRound >= roundID` |

### Functions

| Function | Visibility | Returns | Description |
|---|---|---|---|
| `getLatestPrice()` | `public view` | `int` | Returns the latest ETH/USD price from Chainlink. Reverts if oracle is stale. |
| `getDecimals()` | `public view` | `uint8` | Returns the feed's decimal places (typically `8` for Chainlink USD feeds). |

### Usage in XSDStablecoin

```solidity
function eth_usd_price() public view returns (uint256) {
    return (uint256(eth_usd_pricer.getLatestPrice()) * PRICE_PRECISION)
           / (uint256(10) ** eth_usd_pricer_decimals);
    // PRICE_PRECISION = 1e6
    // Result: ETH/USD in 1e6 precision
    // e.g. ETH = $3000 → returns 3000000000 (3000 * 1e6)
}
```

### Feed Addresses by Network

| Network | Address |
|---|---|
| Ethereum Mainnet | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` |
| Arbitrum | `0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612` |
| Polygon | `0xAB594600376Ec9fD91F8e885dADF0CE036862dE0` |
| Optimism | `0x13e3Ee699D1909E989722E753853AE30b17e08c5` |
| Avalanche | `0x0A77230d17318075983913bC2145DB16C7366156` |
| Fantom | `0xf4766552D15AE4d256Ad41B6cf2933482B0680dc` |

:::note
The constructor hardcodes the feed address at deploy time. Each network deployment uses a separate contract instance pointed at the correct Chainlink ETH/USD feed for that chain. See [Deployments](/projects/BankX/deployments) for deployed addresses.
:::

---

## ChainlinkXAGUSDPriceConsumer

### Purpose

Provides the XAG/USD (silver) price — the fundamental peg reference for XSD. Used in:
- `XSDStablecoin.xag_usd_price()` — the XSD target price feed.
- `PIDController.systemCalculations()` — silver band computation for CR adjustment.
- `CollateralPoolLibrary.calcMintInterest()` — interest accrual uses the silver gram price.

### Oracle Migration: Pyth → Chainlink

When the protocol was first deployed on **Base** and **Avalanche**, Chainlink did not yet offer an XAG/USD (silver) price feed on those networks. To support the silver peg on those chains, the protocol initially integrated **Pyth Network** as the XAG/USD oracle source.

Chainlink has since launched XAG/USD feeds on both Base and Avalanche. The protocol has migrated to Chainlink on those networks. The Chainlink oracle contracts are already deployed — no redeployment is required.

:::note
All currently active deployments use `ChainlinkXAGUSDPriceConsumer`. The Pyth integration is no longer in use.
:::

### Contract Details

| Property | Value |
|---|---|
| Mainnet feed address (hardcoded) | `0x379589227b15F1a12195D3f2d90bBc9F31f95235` |
| Interface | `AggregatorV3Interface` |
| Freshness check | `answeredInRound >= roundID` |

### Functions

| Function | Visibility | Returns | Description |
|---|---|---|---|
| `getLatestPrice()` | `public view` | `int` | Returns the latest XAG/USD price from Chainlink. Reverts if oracle is stale. |
| `getDecimals()` | `public view` | `uint8` | Returns the feed's decimal places. |

### Usage in XSDStablecoin

```solidity
function xag_usd_price() public view returns (uint256) {
    return (uint256(xag_usd_pricer.getLatestPrice()) * PRICE_PRECISION)
           / (uint256(10) ** xag_usd_pricer_decimals);
    // Result: XAG/USD in 1e6 precision
    // e.g. silver = $25/oz → returns 25000000 (25 * 1e6)
    // XSD target price = 25000000 / 1000 = 25000 ($0.025)
}
```

### Feed Addresses by Network

| Network | Address |
|---|---|
| Ethereum Mainnet | `0x379589227b15F1a12195D3f2d90bBc9F31f95235` |
| Arbitrum | `0xC56765f04B248394CF1619D20dB8082Edbfa75b1` |
| Polygon | `0x461c7B8D370a240DdB46B402748381C3210136b3` |
| Optimism | `0x290dd71254874f0d4356443607cb8234958DEe49` |
| Avalanche | `0x4305FB66699C3B2702D4d05CF36551390A4c69C6` |
| Base | See deployed contracts in [Deployments](/projects/BankX/deployments) |

---

## AggregatorV3Interface

Both consumers wrap Chainlink's standard `AggregatorV3Interface`:

```solidity
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function getRoundData(uint80 _roundId) external view returns (
        uint80 roundId, int256 answer, uint256 startedAt,
        uint256 updatedAt, uint80 answeredInRound
    );
    function latestRoundData() external view returns (
        uint80 roundId, int256 answer, uint256 startedAt,
        uint256 updatedAt, uint80 answeredInRound
    );
}
```

The staleness check in both consumers:
```solidity
(uint80 roundID, int price, , , uint80 answeredInRound) = priceFeed.latestRoundData();
require(answeredInRound >= roundID);
return price;
```

This check reverts if Chainlink has not answered the latest round, protecting the protocol from consuming stale data.

---
