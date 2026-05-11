# Arbitrage Restrictions

## Overview

BankX restricts and regulates arbitrage through two complementary systems: the **block-delay mechanism** (which prevents flash-loan-based same-transaction arbitrage) and the **Router circuit breakers** (which limit price deviation and volume per swap, defending against sustained manipulation). Together they create a layered defence that makes economically meaningful manipulation prohibitively expensive.

---

## Block-Delay Mechanism

### How It Works

All mint, redeem, swap, and user liquidity functions require a valid "price check" to have been recorded in the `PIDController` within the last `block_delay` blocks. This is enforced by the `blockDelay` modifier in `CollateralPool`, `Router`, and `RewardManager`:

```solidity
modifier blockDelay() {
    require(
        (pid_controller.lastPriceCheck(msg.sender).lastpricecheck + block_delay) <= block.number
        && pid_controller.lastPriceCheck(msg.sender).pricecheck,
        "BLOCKDELAY"
    );
    _;
    pid_controller.setPriceCheck(msg.sender); // resets pricecheck to false
}
```

The `PriceCheck` struct per address:
```solidity
struct PriceCheck {
    uint256 lastpricecheck; // block number of last priceCheck() call
    bool pricecheck;        // true if a valid check exists, false after use
}
```

### User Flow

1. Call `pid_controller.priceCheck()` — records `lastpricecheck = block.number`, sets `pricecheck = true`.
2. Wait `block_delay` blocks (default: 2).
3. Execute the gated action (mint/redeem/swap/provide liquidity).
4. `setPriceCheck(msg.sender)` is called automatically — resets `pricecheck = false`.
5. The next gated action requires a new `priceCheck()` call.

### Why This Prevents Flash Loans

A flash loan executes entirely within a single transaction (one block). Since `priceCheck()` records a block number and the gated action requires `pricecheck_block + block_delay <= current_block`, an attacker cannot:
- Borrow funds (block N)
- Call `priceCheck()` (block N)
- Call a gated action in the same transaction (also block N, fails: `N + 2 > N`)

The multi-block delay makes same-transaction and same-block arbitrage impossible.

### Exceptions

`mint1t1XSD()` does **not** require `blockDelay`. Fully collateralised 1:1 minting requires WETH equal to the full silver value of XSD — there is no price-manipulation profit opportunity, so the delay is unnecessary.

---

## Router Circuit Breakers

The Router implements three independent circuit-breaker checks on every swap.

### 1. Per-Token Price Deviation Check

Before each swap, the Router computes the current AMM spot price and compares it to the PID Controller's rolling-average price:

```solidity
uint256 deviation = abs(poolPrice, referencePrice);
uint256 deviationPercent = (deviation * 10000) / referencePrice;
if (deviationPercent > price_threshold[token_type]) {
    revert("Price manipulation detected");
}
```

- `price_threshold[0]` — XSD deviation limit (default: `1000` basis points = 10%)
- `price_threshold[1]` — BankX deviation limit (default: `1000` basis points = 10%)

If the AMM spot price deviates more than 10% from the 30-minute rolling average, the swap reverts.

The Router also checks intra-session price movement:
```solidity
uint256 price_deviation = abs(current_price, breaker.last_price);
if (deviation_percentage > price_threshold[token_type]) {
    revert("Price deviation exceeded");
}
```

This compares the current trade's price to the previous trade's recorded price — catching rapid intra-session price moves even if they haven't shifted the rolling average yet.

### 2. Per-Token Volume Check

```solidity
if (volume > volume_threshold[token_type]) {
    revert("Volume threshold exceeded");
}
```

- Default: `1000 ether` per single swap per token type.

A single swap cannot move more than 1000 ETH equivalent through either pool.

### 3. Global Volume Check

Across all swaps in a `timeInterval` (default: 300 seconds / 5 minutes):

```solidity
uint256 totalVolume = volumePerInterval[currentInterval] + newVolume;
if (totalVolume > globalVolumeThreshold) {
    revert("Global volume limit exceeded.");
}
volumePerInterval[currentInterval] = totalVolume;
```

- Default global threshold: `1000 ether` per 5-minute interval.
- If the threshold is hit, no further swaps can execute until the next interval.

The interval key is computed as `block.timestamp / timeInterval`. Each new interval resets automatically.

### Bypassing / Admin Controls

The owner can adjust all circuit breaker parameters:

```solidity
// Per-token thresholds:
router.setSafetyThresholds(
    0,            // token_type: 0=XSD, 1=BankX
    1000,         // price_threshold (basis points)
    1000 ether    // volume_threshold
);

// Global volume:
router.setTimeInterval(300);       // 5-minute window
router.setVolumeThreshold(1000 ether);
router.resetGlobalVolume();        // emergency reset of current interval
```

---

## Minimum Swap Amount

```solidity
require((msg.value * ethPrice) / 1e6 >= minSwapAmountUSD, "ETH input below minimum USD value");
```

Default: `10 * 10**18` = $10 USD (in 18-decimal terms). Prevents griefing via dust swaps that could incrementally manipulate the `breaker.last_price` without economic cost.

---

## Rolling Price Average (10-Slot Buffer)

The PID Controller uses a 10-slot circular buffer updated every `priceUpdateInterval` (default: 180 seconds) to produce a 30-minute price average:

```solidity
// Each slot stores one price observation
xsdPriceHistory[priceHistoryIndex] = currentXsdPrice;
priceHistoryIndex = (priceHistoryIndex + 1) % PRICE_HISTORY_LENGTH; // 10 slots
xsd_updated_price = calculateAveragePrice(xsdPriceHistory);
```

A single manipulated AMM price point contributes at most 1/10th (10%) to the effective protocol price. A sustained manipulation across 30 minutes would cost significant capital.

---

## Summary of Arbitrage Defences

| Attack Vector | Defence |
|---|---|
| Flash loan mint + manipulate + redeem | Block-delay: min 2 blocks between priceCheck and action |
| Single large manipulative swap | Per-token volume limit (1000 ETH), price deviation check (10%) |
| Sustained manipulative trading | Global volume cap (1000 ETH/5min), 30-minute price rolling average |
| Dust swap price manipulation | Minimum swap amount ($10 USD) |
| Rapid intra-session price drift | `breaker.last_price` intra-session deviation check |
