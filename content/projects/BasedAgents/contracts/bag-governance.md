# Bag Governance

## Overview

The repository contains two governor contracts — `BagGovernor.sol` and `BagGovernorImpl.sol` — both built on the same OpenZeppelin modular `Governor` stack: `GovernorUpgradeable` + `GovernorSettingsUpgradeable` + `GovernorCountingSimpleUpgradeable` + `GovernorVotesUpgradeable` + `GovernorVotesQuorumFractionUpgradeable`, with quorum fixed at 10% (`__GovernorVotesQuorumFraction_init(10)`). `BagFactoryImpl` clones whichever contract's bytecode is supplied as `governorImplementation` at factory-construction time and calls its `initialize()` on each new launch — see [Bag Factory](/projects/BasedAgents/contracts/bag-factory).

Both variants take the same `initialize()` parameters: the `Bag` token address (as the `IVotesUpgradeable` voting source), the token creator, and three governance knobs — `votingDelay`, `votingPeriod`, and `proposalThreshold`.

---

## Restricted Proposals

The standout customization in both contracts is `propose()`:

```solidity
function propose(
    address[] memory targets, uint256[] memory values,
    bytes[] memory calldatas, string memory description
) public virtual override returns (uint256) {
    require(msg.sender == proposer, "BagGovernor: Only token creator can create proposals");
    return super.propose(targets, values, calldatas, description);
}
```

(`BagGovernorImpl` names the stored address `tokenCreator` instead of `proposer`, but the check is identical.) This is a meaningful departure from stock OpenZeppelin `Governor` behavior, where any address holding at least `proposalThreshold` votes can propose. Here, only the token's creator can ever put a proposal up for a vote — voting itself still follows the standard `GovernorVotes`/`GovernorCountingSimple` logic once a proposal exists, so token holders vote, but only the creator decides what they vote on.

Both contracts also expose an owner-only `updateGovernanceParameters()` that can retune `votingDelay`, `votingPeriod`, and `proposalThreshold` after deployment via the internal `_setVotingDelay`/`_setVotingPeriod`/`_setProposalThreshold` setters.

---

## `BagGovernor` vs. `BagGovernorImpl`

| | `BagGovernor.sol` | `BagGovernorImpl.sol` |
|---|---|---|
| Upgradeability | Not UUPS — no `_authorizeUpgrade`, no upgrade path | `UUPSUpgradeable`, `onlyOwner`-gated `_authorizeUpgrade` |
| Constructor | None (implicit) | `_disableInitializers()` — the standard safe pattern for a clone-implementation contract |
| Proposer field | `address public proposer` | `address public tokenCreator` |
| **`setProposer(address)`** | **Public, no access modifier at all** | Not present |
| `implementation()` view | Not present | Present, reads `ERC1967Utils.getImplementation()` |

The two are functionally near-duplicates apart from the upgrade path. See [Access Control](/projects/BasedAgents/security/access-control) for what the unguarded `setProposer` on `BagGovernor.sol` actually means in practice.
