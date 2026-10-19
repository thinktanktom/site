# Liveness & Oracle Design

Two items on the `PIDController`: a pair of defects that let the protocol's own self-maintenance entrypoint block itself, and three successive attempts at a manipulation-resistant price average. See [Fix History](/projects/BankX/fixes/overview) for scope and the full index.

---

## 3. systemCalculations(): ratio-step underflow, then a cooldown that DoS'd itself

- **Commits:** `e6e5b1d` (2024-10-28, adds cooldown) → `42e7683` (2024-11-01, fixes underflow) → `c4f139f` (2024-11-01, fixes cooldown placement)
- **File:** `contracts/Oracle/PIDController.sol` (`systemCalculations()`)
- **Category:** underflow / liveness

`systemCalculations()` is a permissionless entrypoint anyone can call. It runs `incentiveChecker1/2/3()` and `priceCheck()` before stepping `global_collateral_ratio`. Both defects below made that entrypoint revert — the thing it must not do, since nothing else performs its work.

### 3a. Ratio-step underflow (`42e7683`)

**Before:**
```solidity
if (xsdprice > XSD_top_band) {
    new_collateral_ratio = last_collateral_ratio - xsd_step;
}
```

**After:**
```solidity
if (xsdprice > XSD_top_band) {
    if (last_collateral_ratio < xsd_step) {
        new_collateral_ratio = 0;
    } else {
        new_collateral_ratio = last_collateral_ratio - xsd_step;
    }
}
```

Solidity 0.8 and above reverts on underflow. Once `last_collateral_ratio < xsd_step`, the unguarded subtraction reverted **every** subsequent call to `systemCalculations()`, with no recovery short of an admin lowering `xsd_step`. The `xsd_step` default of `2500` (0.25%) is documented on [PID Controller](/projects/BankX/contracts/pid-controller); the guard is what makes a CR floor of zero reachable rather than fatal.

### 3b. Cooldown implemented as a hard `require` inside a shared function (`e6e5b1d` → `c4f139f`)

**Before** (introduced by `e6e5b1d`):
```solidity
if (is_active) {
    uint256 delta_collateral_ratio;
    uint256 time_elapsed = block.timestamp - ratio_last_update;
    require(time_elapsed >= collateral_ratio_cooldown, "RATIO COOLDOWN");
    ...
}
```

**After** (`c4f139f`):
```solidity
uint256 time_elapsed = block.timestamp - ratio_last_update;
if (is_active && (time_elapsed >= collateral_ratio_cooldown)) {
    uint256 delta_collateral_ratio;
    ...
}
```

**Root cause:** because the `require` sat *after* the incentive checks and `priceCheck()` had already run in the same call, calling `systemCalculations()` during its own cooldown window reverted the entire transaction — rolling back unrelated state updates (incentive checks, price refresh) that should have completed regardless.

The fix is the shape of the change, not the condition: a cooldown on *one* effect inside a multi-effect function has to be a branch, not a `require`.

**Impact if unfixed:** the system's own self-maintenance entrypoint DoS'd itself for the length of every cooldown window — including immediately after an adjustment, which is exactly when the other checks most needed to run.

---

## 7. The TWAP mechanism, three implementations

- **Commits:** `1aead3d` (2025-03-10), `7d3f5c6` (2025-03-23), `a1f89b4` (2025-03-31)
- **File:** `contracts/Oracle/PIDController.sol`
- **Category:** oracle design

### Attempt 1 (`1aead3d`): block-indexed buffer seeded with fake history

```solidity
uint256 public constant TWAP_PERIOD = 10; // 10 blocks
struct TWAPData { uint256 cumulativePrice; uint256 blockNumber; uint256 timestamp; }
TWAPData[11] public xsdPriceHistory;

uint256 initialCumulativePriceXSD = xsdSpotPrice * TWAP_PERIOD; // = spot price, not a real cumulative
uint256 currentBlock = block.number;
for (uint256 i = 0; i < 11; i++) {
    uint256 simulatedBlock = currentBlock > i ? currentBlock - i : 0;
    xsdPriceHistory[i] = TWAPData(initialCumulativePriceXSD, simulatedBlock, currentTimestamp - i);
}
```

**Defect:** all 11 seeded "history" entries hold the identical spot price. A TWAP's function is to average a spot price against genuinely independent past observations; a buffer pre-filled with copies of the current price is not an average until 10 real blocks have elapsed. It was also indexed by block count rather than wall-clock time, so equivalent windows vary with block time on any chain where that is not constant.

**Also in this commit** (verified via diff, not present before): `require(eth_usd_price > 0, ...)` and equivalents for the BankX and XSD prices, closing a separate path where a stale or zeroed oracle read could propagate into mint/redeem math.

### Attempt 2 (`7d3f5c6`): real cumulative-price TWAP, real-time clock

```solidity
uint256 public xsdCumulativePriceLast;
uint256 public twapPeriod; // e.g. 600s
uint256 public lastTWAPUpdate;

function updateTWAP() public {
    uint256 timeElapsed = block.timestamp - lastTWAPUpdate;
    if (lastTWAPUpdate == 0) {
        xsdCumulativePriceLast = xsdwethpool.price0CumulativeLast();
        lastTWAPUpdate = block.timestamp;
    } else if (timeElapsed >= twapPeriod) {
        uint256 currentCumulative = xsdwethpool.price0CumulativeLast();
        uint256 priceDiff = currentCumulative - xsdCumulativePriceLast;
        uint224 priceAverage = uint224(priceDiff / timeElapsed);
        // ...
    }
}
```

The standard Uniswap-V2 cumulative-price primitive, real-time-based rather than block-count-based. It brings the standard hazards of that primitive with it: `UQ112x112` fixed-point range, plus overflow and wraparound bookkeeping on the accumulator.

### Attempt 3 (`a1f89b4`): fixed-length rolling average — the current implementation

```solidity
uint256 public constant PRICE_HISTORY_LENGTH = 10;
uint256 public priceUpdateInterval = 180; // seconds

function calculateAveragePrice(uint256[] memory history) internal pure returns (uint256) {
    uint256 sum;
    for (uint256 i = 0; i < history.length; i++) { sum += history[i]; }
    return sum / history.length;
}
```

An arithmetic mean of the last 10 samples, sampled at most once per 180s — the 10-slot circular buffer and 30-minute effective window described on [PID Controller](/projects/BankX/contracts/pid-controller). It avoids the cumulative-price accumulator's overflow edge cases.

### Manipulation resistance of the current state

`updatePrices()` is `public` with no access-control modifier, gated only by `currentTime >= lastPriceUpdateTime + priceUpdateInterval`. It has **no same-block or same-transaction guard**, so a transaction that moves the pool price and then calls `updatePrices()` can record a skewed sample, affecting roughly one tenth of the rolling average.

`Router.sol` provides the actual manipulation bound. `checkAndUpdateSafety(token_type, current_price, volume)` runs on every swap path and reverts `"Price manipulation detected"` when:

```
deviationPercent = abs(poolPrice, referencePrice) * 10000 / referencePrice > price_threshold[token_type]
```

with `price_threshold[0] = price_threshold[1] = 1000` — 10%, verified in `Router.sol`.

The division of labour is the point: the 10-sample, 180-second cadence bounds how much a single block can move the **average**; the router's 10% deviation check is what bounds how much a single block can move the underlying **price being sampled**. Neither alone is the defence. See [Arbitrage Restrictions](/projects/BankX/security/arbitrage-restrictions) for the circuit breakers in full.
