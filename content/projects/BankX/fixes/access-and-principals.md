# Access Control & Principal Confusion

Two items, both cases of a contract getting the *identity* of a call wrong — once by checking the wrong address, once by resolving the wrong object from its own state. See [Fix History](/projects/BankX/fixes/overview) for scope and the full index.

---

## 1. RewardManager: cooldown gate checked against `msg.sender` instead of `to`

- **Commit:** `8d0bb4b` (2024-06-22)
- **File:** `contracts/XSD/Pools/RewardManager.sol`
- **Category:** confused deputy

`userProvideBankXLiquidity`, `userProvideXSDLiquidity` and `LiquidityRedemption` each take an explicit `to` beneficiary parameter, separate from `msg.sender`, so a relayer or router can submit on a user's behalf. Each function gates on a per-address cooldown flag set by `PIDController.priceCheck()`, then clears it. Both the check and the clear used `msg.sender`.

**Before:**
```solidity
function userProvideBankXLiquidity(address to) external override nonReentrant{
    require(pid_controller.bucket2(), "RewardManager:NO DEFICIT");
    require(
      (pid_controller.lastPriceCheck(msg.sender).lastpricecheck + block_delay) <= block.number
      && pid_controller.lastPriceCheck(msg.sender).pricecheck,
      "Must wait for block_delay blocks"
    );
    ...
    pid_controller.lastPriceCheck(msg.sender).pricecheck = false;
    emit UserProvideBankXLiquidity(to, amount);
}
```

**After:**
```solidity
function userProvideBankXLiquidity(address to) external override nonReentrant{
    require(pid_controller.bucket2(), "RewardManager:NO DEFICIT");
    require(
      (pid_controller.lastPriceCheck(to).lastpricecheck + block_delay) <= block.number
      && pid_controller.lastPriceCheck(to).pricecheck,
      "Must wait for block_delay blocks"
    );
    ...
    pid_controller.lastPriceCheck(to).pricecheck = false;
    emit UserProvideBankXLiquidity(to, amount);
}
```

The same substitution was applied in `userProvideXSDLiquidity` and `LiquidityRedemption`.

**Root cause:** principal mismatch. The code is correct only when `to == msg.sender`; any call through an intermediary checks and clears the wrong address's state.

**Impact if unfixed:** a relayed call for a beneficiary who hadn't primed their own price-check reverts with "must wait" regardless of correctness. Conversely, a relayer with a primed flag could push a call through and clear the relayer's own flag, leaving the real beneficiary's cooldown gate armed for a payout that had already happened under someone else's state.

The current, fixed behaviour is what [RewardManager](/projects/BankX/contracts/reward-manager) documents as the `blockDelay(to)` modifier on each of those three functions.

**Also in this commit:** the repeated inline `require(msg.sender == smartcontract_owner, ...)` across roughly six admin functions was consolidated into a single `onlyByOwner` modifier — the pattern now described in [Access Control](/projects/BankX/security/access-control).

---

## 6. Router: no reentrancy guard, a validation branch that validated nothing, and breaker identity resolved by hashing state

- **Commits:** `c8a2611` (2025-02-17), `ccc5b20` (2025-02-26), `2a7a3f1` (2025-02-27)
- **File:** `contracts/UniswapFork/Router.sol`
- **Category:** reentrancy / access

### 6a. No reentrancy guard

Through most of `Router.sol`'s history, no function carried a reentrancy guard, despite every swap and liquidity function making external calls (WETH, pool contracts). `c8a2611` added a hand-rolled lock:

```solidity
bool private locked;
modifier lock() {
    require(!locked, "LOCKED");
    locked = true;
    _;
    locked = false;
}
```

This was later replaced with OpenZeppelin's `ReentrancyGuard` (`2a7a3f1`), which is the state [Reentrancy Protection](/projects/BankX/security/reentrancy) documents — including the functions that still deliberately do **not** carry `nonReentrant`.

### 6b. `userRedeemLiquidity`: three branches, no validation

**Before:**
```solidity
function userRedeemLiquidity(address pool, uint deadline) external ensure(deadline) override {
    if (pool == XSDWETH_pool_address) {
        reward_manager.LiquidityRedemption(pool, msg.sender);
    } else if (pool == BankXWETH_pool_address) {
        reward_manager.LiquidityRedemption(pool, msg.sender);
    } else if (pool == collateral_pool_address) {
        reward_manager.LiquidityRedemption(pool, msg.sender);
    }
    // no else: any other address silently falls through
}
```

**After:**
```solidity
function userRedeemLiquidity(address pool, uint deadline) external ensure(deadline) {
    require(
      pool == XSDWETH_pool_address
        || pool == BankXWETH_pool_address
        || pool == collateral_pool_address,
      "Invalid pool"
    );
    reward_manager.LiquidityRedemption(pool, msg.sender);
}
```

**Root cause:** the three near-identical branches read as input validation but weren't. Passing any other address matched no branch, so the function returned without calling anything and the transaction still succeeded.

Worth stating precisely, because it bounds the severity: this was a **silent no-op, not an unchecked call** reaching `RewardManager`. Nothing downstream ever received an invalid address.

**Impact if unfixed:** a correctness and integration-hygiene defect. A caller — or an integrator — cannot distinguish a successful redemption from a silent no-op, because both return without error.

### 6c. Circuit-breaker identity resolved by hashing struct state

`c8a2611` introduced four `CircuitBreaker` structs and resolved "which breaker is this" by hashing the decoded struct values:

```solidity
function getCircuitBreakerType(CircuitBreaker storage breaker) internal view returns (uint8) {
    bytes32 breakerLocation = keccak256(abi.encode(breaker));
    bytes32 eth_to_xsd = keccak256(abi.encode(eth_to_xsd_breaker));
    // ...
    if (breakerLocation == eth_to_xsd) return 0;
    // ...
}
```

**Root cause:** hashing values cannot distinguish two breakers that hold identical field values — and at genesis all four initialise to `is_active=false, price_threshold=0, volume_threshold=0, last_price=0`, so all four hashes are identical.

`2a7a3f1` fixed it by passing `breaker_type` explicitly through the call chain (`getSafety(breaker_type)`, `mapping(uint8 => ...)` thresholds) instead of reverse-engineering identity from state. The per-type thresholds that design makes possible are described in [Arbitrage Restrictions](/projects/BankX/security/arbitrage-restrictions).

**Impact if unfixed:** every circuit-breaker trip event and admin toggle would have resolved to the wrong breaker from the moment the feature shipped.
