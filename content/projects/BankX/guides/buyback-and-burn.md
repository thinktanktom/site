# Buyback and Burn

## Overview

The buyback-and-burn mechanism allows users to profit from excess collateral in the `CollateralPool` while simultaneously reducing the supply of BankX or XSD. When the pool holds more WETH than required at the current collateral ratio, anyone can burn BankX or XSD in exchange for the excess WETH — receiving ETH back at the current market price of the token burned.

---

## When Is Buyback Available?

Buyback requires `availableExcessCollatDV() > 0`. This function returns the dollar value of WETH in the pool above what is required to maintain the current CR:

```solidity
function availableExcessCollatDV() public view returns (uint256) {
    uint256 required = (collat_XSD * global_collateral_ratio * xsd_target_price) / precision;
    uint256 actual   = collatDollarBalance() - unclaimedPoolCollateral;
    return actual > required ? actual - required : 0;
}
```

Also requires `!buyback_paused`.

---

## Buyback BankX (`buyBackBankX`)

Burns BankX and returns excess WETH collateral equivalent to the USD value of BankX burned.

### When to Use

- The collateral pool is over-collateralised (more WETH than required at current CR).
- You hold BankX tokens you want to exchange for ETH at the current BankX price.

### How It Works

```
collateral_equivalent = (BankX_amount * bankx_price) / eth_usd_price
```

The caller burns `BankX_amount` BankX tokens and receives `collateral_equivalent` WETH (unwrapped to ETH).

### Steps

```solidity
// Step 1: priceCheck
IPIDController(PID_ADDRESS).priceCheck();
// Step 2: Wait block_delay blocks

// Step 3: Approve BankX
uint256 bankx_amount = ...; // amount of BankX to burn
IERC20(BANKX_ADDRESS).approve(COLLATERAL_POOL_ADDRESS, bankx_amount);

// Step 4: Query excess collateral (optional, for slippage calc)
uint256 excess = ICollateralPool(payable(COLLATERAL_POOL_ADDRESS)).availableExcessCollatDV();

// Step 5: Compute expected ETH out
uint256 bankx_price   = IPIDController(PID_ADDRESS).bankx_updated_price();
uint256 eth_usd_price = IXSDStablecoin(XSD_ADDRESS).eth_usd_price();
uint256 expected_eth  = (bankx_amount * bankx_price) / eth_usd_price;

// Step 6: Execute buyback
ICollateralPool(payable(COLLATERAL_POOL_ADDRESS)).buyBackBankX(
    bankx_amount,
    expected_eth * 99 / 100, // 1% slippage tolerance
    block.timestamp + 300
);
// Caller receives ETH (native)
```

---

## Buyback XSD (`buyBackXSD`)

Burns XSD and returns excess WETH collateral equivalent to the USD value of XSD burned.

### When to Use

- The collateral pool is over-collateralised.
- You hold XSD purchased on the open market (not necessarily minted by you) and want to exchange it for ETH.

### How It Works

```
collateral_equivalent = (XSD_amount * xsd_price) / eth_usd_price
```

Additionally requires that uncollateralised XSD (`totalSupply + XSD_amount > collat_XSD`) remains positive — i.e. there is always more XSD outstanding than just the collateralised portion.

### Steps

```solidity
IPIDController(PID_ADDRESS).priceCheck();
// Wait block_delay blocks

IERC20(XSD_ADDRESS).approve(COLLATERAL_POOL_ADDRESS, XSD_amount);

uint256 xsd_price    = IPIDController(PID_ADDRESS).xsd_updated_price();
uint256 eth_usd_price = IXSDStablecoin(XSD_ADDRESS).eth_usd_price();
uint256 expected_eth = (XSD_amount * xsd_price) / eth_usd_price;

ICollateralPool(payable(COLLATERAL_POOL_ADDRESS)).buyBackXSD(
    XSD_amount,
    expected_eth * 99 / 100,
    block.timestamp + 300
);
```

---

## Automatic Burn on Swaps (Router)

Separately from the `CollateralPool` buyback functions, the `Router` applies automatic deflationary burns on token sells:

### XSD → ETH Swap (via Router)

After every `swapXSDForETH()`, if:
- Uncollateralised XSD supply `(totalSupply - collat_XSD) > inputAmount / 10`
- `bucket1 == false`

Then 10% of the XSD input amount is burned from the XSD/WETH pool.

### BankX → ETH Swap (via Router)

After every `swapBankXForETH()`, if:
- `totalSupply - amountInMax/10 > genesis_supply`

Then 10% of the BankX input amount is burned from the BankX/WETH pool.

These burns are automatic — callers do not need to do anything extra.

---

## Constraints Summary

| Constraint | buyBackBankX | buyBackXSD |
|---|---|---|
| `availableExcessCollatDV() > 0` | Required | Required |
| `!buyback_paused` | Required | Required |
| `blockDelay` modifier | Required | Required |
| `bucket3 == false` | Not checked | Not checked |
| Excess must cover burn amount | Yes (`bankx_dollar_value <= excess`) | Yes (`xsd_dollar_value <= excess`) |
| uXSD must be positive | No | `totalSupply + amount > collat_XSD` |

---

## Slippage Considerations

Both functions accept a `COLLATERAL_out_min` (or `collateral_out_min`) parameter that reverts if the computed collateral output is below the minimum:

```solidity
require(COLLATERAL_out_min <= collateral_equivalent_d18, "INSUFFICIENT OUTPUT");
```

Always compute expected output off-chain using current BankX/XSD prices from the PID Controller, then apply a slippage tolerance (e.g. 0.5–1%) for the `out_min` parameter.
