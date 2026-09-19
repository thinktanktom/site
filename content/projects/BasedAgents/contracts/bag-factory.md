# Bag Factory

## Overview

The factory is split into two contracts, following the standard proxy/implementation split:

- **`BagFactory.sol`** — a bare `ERC1967Proxy`. Its entire body is a constructor that forwards `_logic` and `_data` to OpenZeppelin's proxy constructor. All actual logic lives behind it.
- **`BagFactoryImpl.sol`** — the logic contract. `UUPSUpgradeable` + `OwnableUpgradeable` + `ReentrancyGuardUpgradeable`. This is what token creators actually call.

---

## Construction and Initialization

`BagFactoryImpl`'s constructor takes three addresses and stores them as `immutable`:

```solidity
constructor(address _tokenImplementation, address _governorImplementation, address _bondingCurve) initializer {
    tokenImplementation = _tokenImplementation;
    governorImplementation = _governorImplementation;
    bondingCurve = _bondingCurve;
}
```

Because these are `immutable` (baked into the implementation contract's bytecode, not stored in the proxy's storage slots), upgrading `BagFactoryImpl` to a new logic contract via UUPS does **not** retroactively change which `Bag`/`BagGovernor` bytecode future `deploy()` calls clone from — a new implementation with different immutables would need to be deployed and pointed at explicitly. The separate `initialize(address _owner)` function (called once, via the `BagFactory` proxy's constructor `_data`) sets up the UUPS/reentrancy-guard/ownable state and transfers ownership to `_owner`.

---

## `deploy()`

```solidity
function deploy(
    address _tokenCreator, address _platformReferrer, string memory _tokenURI,
    string memory _name, string memory _symbol,
    uint48 _votingDelay, uint32 _votingPeriod, uint256 _proposalThreshold
) external payable nonReentrant returns (address token, address governor)
```

This is the single public entry point for launching a new agent token, and it is **not** owner-gated — any address can call it. In one transaction it:

1. Derives a deterministic salt from the caller, creator, token URI hash, and several block-level values.
2. Clones `tokenImplementation` to that salt and calls `Bag.initialize(...)` on the clone, forwarding any ETH sent (`{value: msg.value}`) so the creator can seed the bonding curve with an opening buy in the same transaction.
3. Derives a second salt (`keccak256(tokenSalt, "governor")`) and clones `governorImplementation`, calling `BagGovernor.initialize(...)` with the new token as the voting source and the supplied governance parameters.
4. Emits `BagTokenCreated` and `GovernorCreated`, both carrying the new token and governor addresses for off-chain indexing.

`nonReentrant` guards the whole function, which matters here because `Bag.initialize()` can itself execute an ETH-value bonding-curve buy mid-call.

---

## Upgradeability

`_authorizeUpgrade` is `onlyOwner` — only the factory's owner can push a new implementation contract behind the `BagFactory` proxy. This is the standard, minimal UUPS pattern: no timelock or multi-step upgrade process is implemented in this contract, so an upgrade takes effect as soon as the owner submits it.
