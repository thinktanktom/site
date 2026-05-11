# Minting XSD

## Overview

XSD can be minted in three modes depending on the current `global_collateral_ratio`. The ratio is read from the `PIDController` at the time of the mint transaction. All minting flows require ETH (converted to WETH internally) and/or BankX tokens, and produce XSD at the caller's address. Interest begins accruing immediately.

---

## Pre-Flight: The priceCheck Requirement

Fractional and algorithmic minting both require the `blockDelay` modifier, which checks that:

1. `pid_controller.lastPriceCheck(msg.sender).pricecheck == true`
2. `pid_controller.lastPriceCheck(msg.sender).lastpricecheck + block_delay <= block.number`

This means you must call `pid_controller.priceCheck()` **before** the mint transaction and then wait `block_delay` blocks (default: 2).

`mint1t1XSD()` (100% CR) does **not** require `blockDelay`.

---

## Mode 1: 1:1 Mint (CR = 100%)

Used when `global_collateral_ratio == 1000000`.

### Required

- ETH (sent as `msg.value`)
- No BankX required

### Steps

```solidity
// No priceCheck needed for 1:1 mint

// Calculate ETH required:
// neededWETH = XSD_amount * pid.neededWETH() / 1e6
// pid.neededWETH() = weth_dollar_needed / eth_usd_price

ICollateralPool pool = ICollateralPool(payable(COLLATERAL_POOL_ADDRESS));
pool.mint1t1XSD{value: ethAmount}(
    XSD_amount,          // minimum XSD expected
    block.timestamp + 300 // deadline
);
```

### What Happens

1. `msg.value` is validated against `pid_controller.neededWETH()`.
2. ETH is deposited to WETH and held in the pool.
3. `mintInterestCalc()` initialises the caller's `mintMapping` entry.
4. `collat_XSD` is incremented by `XSD_amount`.
5. `XSD.pool_mint(msg.sender, XSD_amount)` mints XSD to the caller.

---

## Mode 2: Fractional Mint (0 < CR < 100%)

Used when `0 < global_collateral_ratio < 1000000`.

### Required

- ETH (as `msg.value`) — proportional to CR
- BankX tokens (approved to `CollateralPool`) — proportional to `(1 - CR)`

### Steps

```solidity
// Step 1: Call priceCheck() on PID Controller
IPIDController(PID_ADDRESS).priceCheck();

// Step 2: Wait block_delay blocks (default: 2), then proceed

// Step 3: Approve BankX to CollateralPool
uint256 bankx_needed = (XSD_amount * pid.neededBankX()) / 1e6;
IERC20(BANKX_ADDRESS).approve(COLLATERAL_POOL_ADDRESS, bankx_needed);

// Step 4: Compute ETH needed
uint256 eth_needed = (XSD_amount * pid.neededWETH()) / 1e6;
// Convert eth_needed from 1e6 dollar units to wei:
// actual_eth = eth_needed * 1e18 / eth_usd_price

// Step 5: Mint
ICollateralPool pool = ICollateralPool(payable(COLLATERAL_POOL_ADDRESS));
pool.mintFractionalXSD{value: actualEthWei}(
    XSD_amount,           // XSD to receive
    bankx_needed,         // BankX to burn
    block.timestamp + 300 // deadline
);
```

### What Happens

1. CR and required amounts are validated.
2. BankX is burned from the caller via `BankX.pool_burn_from()`.
3. ETH is converted to WETH and held in the pool.
4. Interest state is initialised / updated via weighted average.
5. `collat_XSD` and `bankx_minted_count` are incremented.
6. XSD is minted to the caller.

---

## Mode 3: Algorithmic Mint (CR = 0%)

Used when `global_collateral_ratio == 0`.

### Required

- BankX tokens only (no ETH)
- No ETH required

### Steps

```solidity
// Step 1: priceCheck
IPIDController(PID_ADDRESS).priceCheck();

// Step 2: Wait block_delay blocks

// Step 3: Approve BankX
uint256 bankx_needed = (XSD_amount * pid.neededBankX()) / 1e6;
IERC20(BANKX_ADDRESS).approve(COLLATERAL_POOL_ADDRESS, bankx_needed);

// Step 4: Mint
pool.mintAlgorithmicXSD(
    bankx_needed,         // BankX to burn
    XSD_amount,           // XSD to receive
    block.timestamp + 300
);
```

---

## Calculating Required Inputs

Use the PID Controller's `neededWETH` and `neededBankX` view values, which are updated by `priceCheck()`:

```solidity
IPIDController pid = IPIDController(PID_ADDRESS);

// Call priceCheck first to refresh values
pid.priceCheck();

uint256 neededWETH  = pid.neededWETH();  // 1e6 dollars of WETH per 1 XSD
uint256 neededBankX = pid.neededBankX(); // 1e6 dollars of BankX per 1 XSD
uint256 ethPrice    = XSD.eth_usd_price(); // 1e6 USD per ETH
uint256 bankxPrice  = pid.bankx_updated_price(); // 1e6 USD per BankX

// For XSD_amount of XSD:
uint256 eth_dollar_needed  = (XSD_amount * neededWETH) / 1e6;
uint256 bankx_dollar_needed = (XSD_amount * neededBankX) / 1e6;

// Convert to token amounts:
uint256 eth_wei_needed   = (eth_dollar_needed * 1e6) / ethPrice;
uint256 bankx_wei_needed = (bankx_dollar_needed * 1e6) / bankxPrice;
```

---

## Slippage and Deadlines

- **`XSD_amount`** in mint functions is the **expected** XSD output, not a minimum — the contract mints exactly `XSD_amount` tokens (subject to sufficient input). Compute `XSD_amount` off-chain using the current prices and add a slippage buffer.
- **`deadline`** reverts the transaction if `block.timestamp > deadline`. Use a short deadline (2–5 minutes) to avoid executing at stale prices.

---

## After Minting

Interest begins accruing from the moment of the mint. The `mintMapping` entry records:
- `amount` — total XSD minted by this address through this pool.
- `interest_rate` — weighted-average rate at time of mint.
- `time` — block timestamp of the mint.
- `accum_interest` — starts at 0; grows each day.

To redeem, see the [Redeeming XSD](./redeeming-xsd.md) guide.
