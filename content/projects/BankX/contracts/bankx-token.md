# BankXToken

## Overview

`BankXToken` is the ERC-20 contract for the BankX utility and governance token. It extends `ERC20Custom` and gates all mint and burn operations to addresses whitelisted in the `XSDStablecoin` pool registry. BankX is used as fractional collateral during XSD minting, burned during fractional and algorithmic minting, minted to users as interest payments and liquidity rewards, and burned deflationally during BankX-for-ETH swaps.

---

## Key Concepts

- **Pool-gated mint/burn.** The `onlyPools` modifier checks `XSD.xsd_pools(msg.sender)` — the same whitelist used by `XSDStablecoin`. BankX shares the pool registry with XSD; any address added to the XSD pool registry can mint and burn BankX.
- **`genesis_supply`** — Total initial supply (treasury amount + pool bootstrap amount). Used as the deflationary reference in `burnpoolBankX()`.
- **`burnpoolBankX()`** — Callable only by the Router. Burns BankX from the BankX/WETH AMM pool when total supply exceeds genesis supply and calls `sync()` on the pool. This applies deflationary pressure during BankX-for-ETH swaps.
- **`treasury`** — Receives the genesis supply at deployment. The pool bootstrap amount is minted to `msg.sender` (the deployer).

---

## Architecture

```
BankXToken
├── Inherits: ERC20Custom
├── References: XSDStablecoin (for pool whitelist checks)
├── Calls:   IBankXWETHpool.sync()   (burnpoolBankX)
└── Written by: CollateralPool (pool_mint, pool_burn_from)
               RewardManager (pool_mint for rewards)
               Router (burnpoolBankX)
               Owner (setters)
```

---

## State Variables

| Variable | Type | Visibility | Description |
|---|---|---|---|
| `name` | `string` | `public` | Token name |
| `symbol` | `string` | `public` | Token symbol (e.g. "BankX") |
| `decimals` | `uint8` | `public constant` | Always `18` |
| `router` | `address` | `public` | Address of the Router; only caller allowed to invoke `burnpoolBankX()` |
| `treasury` | `address` | `public` | Treasury address |
| `pool_address` | `address` | `public` | BankX/WETH AMM pool address; target of `burnpoolBankX()` |
| `genesis_supply` | `uint256` | `public` | Initial supply = treasury mint + pool mint |
| `smartcontract_owner` | `address` | `public` | Protocol owner |
| `XSD` | `XSDStablecoin` | `private` | Reference to XSD contract for pool whitelist lookup |

---

## Core Functions

### Pool-Gated (onlyPools)

| Function | Params | Access | Description |
|---|---|---|---|
| `mint(address to, uint256 amount)` | recipient, amount | `onlyPools` | Mints BankX to `to`. |
| `pool_mint(address m_address, uint256 m_amount)` | recipient, amount | `onlyPools` | Identical to `mint`; exists for interface compatibility with `XSDStablecoin`. |
| `pool_burn_from(address b_address, uint256 b_amount)` | account, amount | `onlyPools` | Burns BankX from `b_address`. Called by `CollateralPool` when burning BankX during fractional/algorithmic minting. |

### Public (Router-Only)

| Function | Params | Access | Description |
|---|---|---|---|
| `burnpoolBankX(uint _bankx_amount)` | amount | Router only | Burns BankX from `pool_address`. Only callable by `router`. Requires `totalSupply() > genesis_supply`. Calls `IBankXWETHpool(pool_address).sync()`. |

### Owner-Only (onlyByOwner)

| Function | Description |
|---|---|
| `setPool(address new_pool)` | Sets the BankX/WETH pool address used by `burnpoolBankX()`. |
| `setTreasury(address new_treasury)` | Updates the treasury address. |
| `setRouterAddress(address _router)` | Updates the Router address. |
| `setXSDAddress(address xsd_contract_address)` | Updates the XSD reference (changing the pool whitelist). |
| `setSmartContractOwner(address)` | Transfers ownership. |
| `renounceOwnership()` | Sets `smartcontract_owner = address(0)`. Irreversible. |

---

## Events

| Event | Parameters | When Emitted |
|---|---|---|
| `BankXMinted(address from, address to, uint256 amount)` | Contract, recipient, amount | `mint()`, `pool_mint()` |
| `BankXBurned(address from, address to, uint256 amount)` | Initiator, contract, amount | `pool_burn_from()`, `burnpoolBankX()` |
| `XSDAddressSet(address addr)` | New XSD address | `setXSDAddress()` |

---

## Integration Guide

```solidity
interface IBankXToken {
    function mint(address to, uint256 amount) external;
    function pool_mint(address m_address, uint256 m_amount) external;
    function pool_burn_from(address b_address, uint256 b_amount) external;
    function genesis_supply() external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

// Check if BankX is currently deflationary (can be burned):
bool deflationary = IBankXToken(BANKX_ADDRESS).totalSupply()
                    > IBankXToken(BANKX_ADDRESS).genesis_supply();

// Approve BankX to CollateralPool before fractional mint:
IERC20(BANKX_ADDRESS).approve(COLLATERAL_POOL_ADDRESS, bankx_amount);
ICollateralPool(COLLATERAL_POOL_ADDRESS).mintFractionalXSD(
    xsd_amount,
    bankx_amount,
    block.timestamp + 300 // 5-minute deadline
);
```
