# CollateralPool

## Overview

`CollateralPool` is the core vault contract of the BankX protocol. It accepts WETH as collateral, mints and burns XSD, tracks per-user interest, and handles the buyback-and-burn mechanism. All minting and redeeming is subject to the current `global_collateral_ratio` reported by the `PIDController`. The contract implements `ReentrancyGuard` and a block-delay anti-flash-loan mechanism.

---

## Key Concepts

- **`collat_XSD`** — Running total of XSD that has been minted through this pool and is currently outstanding. Used for collateralisation accounting.
- **`mintMapping`** — Per-address `MintInfo` struct tracking accumulated interest, weighted-average rate, last interaction time, and principal XSD amount.
- **Redemption staging.** Redemptions are split into two steps: a redeem call (burns XSD, queues collateral and BankX) and `collectRedemption()` (transfers queued assets) separated by `block_delay` blocks.
- **`block_delay`** — Default: `2` blocks. Prevents flash loans that mint XSD, manipulate prices, then redeem in the same transaction.
- **`blockDelay` modifier** — Requires that `pid_controller.lastPriceCheck(msg.sender).pricecheck == true` AND the last price check block + `block_delay <= block.number`. After each call with this modifier, `pricecheck` is reset to `false`, requiring a new `priceCheck()` call before the next action.
- **Pause flags.** `mint_paused`, `redeem_paused`, `buyback_paused` are owner-controlled.

---

## Architecture

```
CollateralPool
├── Inherits: Initializable, ReentrancyGuard
├── Calls: XSDStablecoin.pool_mint() / pool_burn_from()
├── Calls: BankXToken.pool_mint() / pool_burn_from()
├── Reads: IPIDController.global_collateral_ratio()
│         IPIDController.neededWETH()
│         IPIDController.neededBankX()
│         IPIDController.bankx_updated_price()
│         IPIDController.xsd_updated_price()
│         IPIDController.bucket3()
│         IPIDController.lastPriceCheck()
├── Calls: IPIDController.setPriceCheck()
├── Calls: CollateralPoolLibrary (interest + buyback math)
├── Holds: WETH (via IWETH deposit/withdraw)
└── Admin: Owner only
```

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `WETH` | `address` | WETH contract address |
| `smartcontract_owner` | `address` | Contract owner |
| `xsd_contract_address` | `address` | XSD stablecoin address |
| `bankx_contract_address` | `address` | BankX token address |
| `xsdweth_pool` | `address` | XSD/WETH AMM pool |
| `bankxweth_pool` | `address` | BankX/WETH AMM pool |
| `pid_address` | `address` | PID Controller address |
| `collat_XSD` | `uint256` | Total XSD minted through this pool and outstanding |
| `mint_paused` | `bool` | Pauses all minting functions |
| `redeem_paused` | `bool` | Pauses all redemption functions |
| `buyback_paused` | `bool` | Pauses buyback functions |
| `mintMapping` | `mapping(address => MintInfo)` | Per-user mint state |
| `redeemBankXTokenBalances` | `mapping(address => uint256)` | Queued BankX token amounts (in tokens, not USD) |
| `redeemBankXBalances` | `mapping(address => uint256)` | Queued BankX USD values |
| `redeemCollateralBalances` | `mapping(address => uint256)` | Queued WETH values in USD |
| `vestingtimestamp` | `mapping(address => uint256)` | (Unused in current version) |
| `unclaimedPoolCollateral` | `uint256` | Total USD value of WETH queued for redemption |
| `unclaimedPoolBankX` | `uint256` | Total BankX tokens queued for redemption |
| `collateral_equivalent_d18` | `uint256` | Scratch variable for buyback calculations |
| `bankx_minted_count` | `uint256` | Cumulative BankX burned during fractional/algorithmic mints |
| `lastRedeemed` | `mapping(address => uint256)` | Block number of last redeem call; enforces `block_delay` in `collectRedemption()` |
| `block_delay` | `uint256` | Minimum blocks between redeem and collect. Default: `2`. |

---

## Core Functions

### Views

| Function | Mutability | Description |
|---|---|---|
| `collatDollarBalance()` | `view` | Returns USD value of WETH held in the pool: `WETH.balanceOf(this) * eth_usd_price / 1e6`. |
| `availableExcessCollatDV()` | `view` | Returns USD value of collateral above what is required at the current CR. Used for buyback eligibility. |

### Minting (nonReentrant, mintPaused)

| Function | Access | Modifiers | When Valid |
|---|---|---|---|
| `mint1t1XSD(uint256 XSD_amount, uint256 deadline)` | `external payable` | `ensure`, `nonReentrant`, `mintPaused` | `CR == 1000000` (100%) |
| `mintFractionalXSD(uint256 XSD_amount, uint bankx_amount, uint256 deadline)` | `external payable` | `ensure`, `nonReentrant`, `mintPaused`, `blockDelay` | `0 < CR < 1000000` |
| `mintAlgorithmicXSD(uint256 bankx_amount_d18, uint256 XSD_amount, uint256 deadline)` | `external` | `ensure`, `nonReentrant`, `mintPaused`, `blockDelay` | `CR == 0` |

**`mint1t1XSD` does not require `blockDelay`** — it is fully collateralised by WETH and presents no flash-loan risk.

### Redemption (nonReentrant, redeemPaused, blockDelay)

| Function | Access | When Valid |
|---|---|---|
| `redeem1t1XSD(uint256 XSD_amount, uint256 COLLATERAL_out_min, uint256 deadline)` | `external` | `CR == 1000000`, `bucket3 == false` |
| `redeemFractionalXSD(uint256 XSD_amount, uint256 BankX_out_min, uint256 COLLATERAL_out_min, uint256 deadline)` | `external` | `0 < CR < 1000000`, `bucket3 == false` |
| `redeemAlgorithmicXSD(uint256 XSD_amount, uint256 BankX_out_min, uint256 deadline)` | `external` | `CR == 0`, `bucket3 == false` |
| `collectRedemption()` | `external` | After `block_delay` blocks, `bucket3 == false` |

All redeem functions enforce `XSD_amount <= mintMapping[msg.sender].amount` (overredemption guard).

### Buyback

| Function | Access | Modifiers | Description |
|---|---|---|---|
| `buyBackBankX(uint256 BankX_amount, uint256 COLLATERAL_out_min, uint256 deadline)` | `external` | `blockDelay`, `ensure` | Burns BankX in exchange for excess WETH collateral. |
| `buyBackXSD(uint256 XSD_amount, uint256 collateral_out_min, uint256 deadline)` | `external` | `blockDelay`, `ensure` | Burns XSD in exchange for excess WETH collateral. |

### Admin (onlyByOwner)

| Function | Description |
|---|---|
| `setPoolParameters(uint256 new_block_delay, bool _mint_paused, bool _redeem_paused, bool _buyback_paused)` | Adjusts block delay and pause states. |
| `setPIDController(address new_pid_address)` | Updates PID Controller reference. |
| `setSmartContractOwner(address)` | Transfers ownership. |
| `renounceOwnership()` | Irreversibly sets owner to `address(0)`. |
| `resetAddresses(...)` | Bulk address reset (XSD, BankX, pools, WETH). |

---

## Events

| Event | Parameters | When Emitted |
|---|---|---|
| `PoolParametersSet(uint256, bool, bool, bool)` | new_block_delay, mint_paused, redeem_paused, buyback_paused | `setPoolParameters()` |
| `RedemptionCollected(address, uint, uint)` | user, bankxAmount, collateralAmount | `collectRedemption()` |

---

## Security Considerations

- **`nonReentrant` on all mint/redeem/collect.** All state-changing user functions in `CollateralPool` carry OpenZeppelin's `nonReentrant` guard.
- **Two-step redemption prevents flash loans.** XSD is burned in the redeem call. Collateral and BankX are only transferred `block_delay` blocks later via `collectRedemption()`. An attacker cannot mint, manipulate, and redeem in a single transaction.
- **`bucket3` redemption block.** If `pid_controller.bucket3() == true`, all redeem functions and `collectRedemption()` revert. Redemptions resume only when the collateral deficit is resolved.
- **`blockDelay` requires a prior `priceCheck()`.** Fractional minting, algorithmic minting, and all redeems require the caller to have a valid `priceCheck` recorded in the PID Controller within the last `block_delay` blocks.
- **Overredemption guard.** `XSD_amount <= mintMapping[msg.sender].amount` ensures a user cannot redeem more XSD than they personally minted, preventing draining the pool via fabricated redemptions.
- **`receive()` restricted to WETH.** The fallback `receive()` function only accepts ETH from the WETH contract. Direct ETH sends revert.

---

## Integration Guide

```solidity
ICollateralPool pool = ICollateralPool(payable(COLLATERAL_POOL_ADDRESS));

// Step 1: Call priceCheck() on PID Controller to satisfy blockDelay modifier
IPIDController(PID_ADDRESS).priceCheck();

// Step 2a: 1:1 mint (CR = 100%)
pool.mint1t1XSD{value: ethAmount}(XSD_amount, block.timestamp + 300);

// Step 2b: Fractional mint (0 < CR < 100%)
IERC20(BANKX_ADDRESS).approve(COLLATERAL_POOL_ADDRESS, bankx_amount);
pool.mintFractionalXSD{value: ethAmount}(XSD_amount, bankx_amount, block.timestamp + 300);

// Step 3: Fractional redeem
IERC20(XSD_ADDRESS).approve(COLLATERAL_POOL_ADDRESS, XSD_amount);
pool.redeemFractionalXSD(XSD_amount, bankx_min, collateral_min, block.timestamp + 300);

// Step 4: Wait block_delay blocks, then collect
// (Must call priceCheck() again before collectRedemption)
IPIDController(PID_ADDRESS).priceCheck();
pool.collectRedemption();
```
