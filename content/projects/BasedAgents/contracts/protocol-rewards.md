# ProtocolRewards

## Overview

`ProtocolRewards` is a standalone ETH escrow contract with no owner and no admin functions. It exists to solve one problem: every `Bag` token trade needs to pay out to four different addresses (creator, protocol, platform referrer, order referrer), and pushing ETH directly to all four on every trade means one broken or malicious recipient can revert the entire trade. Instead, fees are deposited into a per-address balance here, and each recipient withdraws on their own schedule.

---

## Core Functions

| Function | Access | Description |
|---|---|---|
| `deposit(address to, bytes4 reason, string comment)` | Anyone, payable | Credits `msg.value` to `to`'s balance. `reason` is an indexable tag. |
| `depositBatch(address[] recipients, uint256[] amounts, bytes4[] reasons, string comment)` | Anyone, payable | Credits multiple balances in one call; reverts if `msg.value` doesn't exactly match the sum of `amounts`. This is what `Bag._disperseFees()` calls on every trade. |
| `depositRewards(...)` | Anyone, payable | A wider variant with named parameters for creator/referral/mint/first-minter/protocol rewards — present in the contract but not the path `Bag.sol` exercises. |
| `withdraw(address to, uint256 amount)` | `msg.sender` only | Withdraws from the caller's own balance. `amount == 0` withdraws the full balance. |
| `withdrawFor(address to, uint256 amount)` | Anyone | Withdraws **on behalf of** `to`, sending the ETH to `to` — anyone can trigger this, but the funds can only ever go to the balance holder. |
| `withdrawWithSig(address from, address to, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)` | Anyone, with a valid signature | Gasless withdrawal: a relayer submits the transaction, but the ETH only moves if `ecrecover` on an EIP-712 digest resolves to `from`. |

`totalSupply()` simply returns `address(this).balance` — the contract's own ETH balance is definitionally the sum of every outstanding credit, since ETH only enters via `deposit*` and only leaves via `withdraw*`.

---

## EIP-712 Gasless Withdrawal

`ProtocolRewards` extends a local `EIP712` implementation and defines:

```solidity
bytes32 public constant WITHDRAW_TYPEHASH =
    keccak256("Withdraw(address from,address to,uint256 amount,uint256 nonce,uint256 deadline)");
```

`withdrawWithSig` hashes the withdrawal parameters together with a per-account `nonces[from]` (incremented on use, preventing signature replay), checks `block.timestamp <= deadline`, and recovers the signer via `ecrecover`. If the recovered address doesn't match `from`, or the deadline has passed, the call reverts. This lets a balance holder sign a withdrawal off-chain and have anyone else (a relayer, a frontend, another user) pay the gas to execute it.

---

## Design Note

This contract's shape — an ownerless, permissionless deposit/withdraw ledger with batch deposits, named "reasons" for indexing, and an EIP-712 gasless withdrawal path — closely mirrors the `ProtocolRewards` pattern used elsewhere for NFT and token-launch protocols that need to fan fees out to multiple parties without trusting any single push-payment call to succeed. It's a well-tested shape for exactly this problem: no admin key can freeze or redirect funds, and a single reverting recipient can never block a trade.
