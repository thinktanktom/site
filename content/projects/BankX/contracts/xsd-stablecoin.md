# XSDStablecoin

## Overview

`XSDStablecoin` is the ERC-20 contract for XSD, the BankX silver-pegged stablecoin. It extends `ERC20Custom` and acts as the central registry for whitelisted pool addresses — only pools registered in `xsd_pools` are permitted to mint or burn XSD. The contract also exposes the Chainlink oracle price queries used by the rest of the protocol.

---

## Key Concepts

- **Pool registry.** `xsd_pools` is a mapping of `address → bool`. Any contract added via `addPool()` can call `pool_mint()` and `pool_burn_from()`. Only the `CollateralPool` is added in the current deployment.
- **`cap_rate`** — Maximum total supply that the `creatorMint()` function will not exceed. Set at construction.
- **`genesis_supply`** — Initial supply minted at construction, split between the owner (pool bootstrap) and treasury.
- **`PRICE_PRECISION = 1e6`** — All price values returned by this contract are in 1e6 precision (6 decimal places).
- **`burnpoolXSD`** — Burns XSD from the XSD/WETH AMM pool and calls `sync()`. Callable only by the Router. Used during XSD-for-ETH swaps to apply deflationary pressure.
- **`burnUserXSD`** — Allows any user to voluntarily burn their own XSD, subject to the constraint that uncollateralised XSD supply (`totalSupply - collat_XSD`) remains positive.

---

## Architecture

```
XSDStablecoin
├── Inherits: ERC20Custom
├── Queries: ChainlinkETHUSDPriceConsumer
├── Queries: ChainlinkXAGUSDPriceConsumer
├── Calls:   IXSDWETHpool.sync()       (burnpoolXSD)
├── Reads:   ICollateralPool.collat_XSD()
└── Written by: CollateralPool (pool_mint, pool_burn_from)
               Router (burnpoolXSD)
               Owner (addPool, removePool, setters)
```

---

## State Variables

| Variable | Type | Visibility | Description |
|---|---|---|---|
| `symbol` | `string` | `public` | Token symbol (e.g. "XSD") |
| `name` | `string` | `public` | Token name |
| `decimals` | `uint8` | `public constant` | Always `18` |
| `treasury` | `address` | `public` | Treasury address; receives genesis supply |
| `collateral_pool_address` | `address` | `public` | Address of the `CollateralPool` |
| `router` | `address` | `public` | Address of the `Router` |
| `eth_usd_oracle_address` | `address` | `public` | Chainlink ETH/USD consumer address |
| `xag_usd_oracle_address` | `address` | `public` | Chainlink XAG/USD consumer address |
| `smartcontract_owner` | `address` | `public` | Protocol owner / deployer |
| `cap_rate` | `uint256` | `public` | Maximum supply cap for `creatorMint()` |
| `genesis_supply` | `uint256` | `public` | Initial supply (pool amount + treasury amount) |
| `xsd_pools_array` | `address[]` | `public` | Enumerable list of whitelisted pool addresses |
| `xsd_pools` | `mapping(address => bool)` | `public` | Fast pool whitelist lookup |
| `PRICE_PRECISION` | `uint256` | `private constant` | `1e6` — price normalisation factor |

---

## Core Functions

### Views

| Function | Visibility | Description |
|---|---|---|
| `eth_usd_price()` | `public view` | Returns ETH/USD price normalised to 1e6. Formula: `getLatestPrice() * 1e6 / 10^decimals`. |
| `xag_usd_price()` | `public view` | Returns XAG/USD (silver) price normalised to 1e6. Used as the XSD peg reference. |

### Pool-Gated (onlyPools)

| Function | Params | Access | Description |
|---|---|---|---|
| `pool_mint(address m_address, uint256 m_amount)` | recipient, amount | `onlyPools` | Mints XSD to `m_address`. Called by `CollateralPool` on user mint. |
| `pool_burn_from(address b_address, uint256 b_amount)` | account, amount | `onlyPools` | Burns XSD from `b_address` using allowance. Called by `CollateralPool` on redeem. |

### Public (Permissionless)

| Function | Params | Access | Modifiers | Description |
|---|---|---|---|---|
| `burnpoolXSD(uint _xsdamount)` | amount to burn | Router only | None | Burns XSD from the XSD/WETH pool. Only callable by `router`. Requires uncollateralised XSD > burn amount. Calls `xsdEthPool.sync()`. |
| `burnUserXSD(uint _xsdamount)` | amount to burn | Any user | None | Burns XSD from `msg.sender`. Requires uncollateralised XSD > burn amount. |

### Owner-Only (onlyByOwner)

| Function | Description |
|---|---|
| `creatorMint(uint256 amount)` | Mints additional XSD to treasury, subject to `genesis_supply + amount < cap_rate`. |
| `addPool(address pool_address)` | Whitelists a pool address. |
| `removePool(address pool_address)` | Removes a pool from the whitelist (sets mapping to false, sets array entry to `address(0)`). |
| `setTreasury(address)` | Updates the treasury address. |
| `setETHUSDOracle(address)` | Updates the Chainlink ETH/USD consumer. |
| `setXAGUSDOracle(address)` | Updates the Chainlink XAG/USD consumer. |
| `setRouterAddress(address)` | Updates the Router address. |
| `setXSDEthPool(address)` | Sets the XSD/WETH AMM pool reference. |
| `setBankXEthPool(address)` | Sets the BankX/WETH AMM pool reference. |
| `setCollateralEthPool(address)` | Sets the CollateralPool address. |
| `setSmartContractOwner(address)` | Transfers ownership. |
| `renounceOwnership()` | Sets `smartcontract_owner = address(0)`. Irreversible. |

---

## Events

| Event | Parameters | When Emitted |
|---|---|---|
| `XSDMinted(address from, address to, uint256 amount)` | Pool, recipient, amount | `pool_mint()` call |
| `XSDBurned(address from, address to, uint256 amount)` | Initiator, contract, amount | `pool_burn_from()`, `burnpoolXSD()`, `burnUserXSD()` |
| `PoolAdded(address pool_address)` | New pool address | `addPool()` |
| `PoolRemoved(address pool_address)` | Removed pool address | `removePool()` |
| `ETHUSDOracleSet(address)` | New oracle address | `setETHUSDOracle()` |
| `XAGUSDOracleSet(address)` | New oracle address | `setXAGUSDOracle()` |
| `XSDETHPoolSet(address)` | Pool address | `setXSDEthPool()` |
| `BankXEthPoolSet(address)` | Pool address | `setBankXEthPool()` |

---

## Security Considerations

- **`burnUserXSD` guard.** The `totalSupply - collat_XSD > _xsdamount` check ensures that user burns do not touch collateralised XSD, preserving the solvency accounting.

---

## Integration Guide

```solidity
interface IXSDStablecoin {
    function eth_usd_price() external view returns (uint256);
    function xag_usd_price() external view returns (uint256);
    function pool_mint(address m_address, uint256 m_amount) external;
    function pool_burn_from(address b_address, uint256 b_amount) external;
    function xsd_pools(address pool) external view returns (bool);
}

// Reading the silver peg price (USD per XSD target, 1e6 precision):
uint256 xag_price = IXSDStablecoin(XSD_ADDRESS).xag_usd_price();
uint256 xsd_target_usd = xag_price / 1000; // 1/1000 troy oz of silver

// Checking if an address is a whitelisted pool:
bool is_pool = IXSDStablecoin(XSD_ADDRESS).xsd_pools(MY_CONTRACT);
```
