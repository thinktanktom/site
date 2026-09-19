# Mainnet Fork Tests

## Why Fork Mainnet

`Bag.sol`'s entire graduation mechanism depends on live Uniswap V3 infrastructure — `createAndInitializePoolIfNecessary`, `INonfungiblePositionManager.mint`, and `ISwapRouter.exactInputSingle` all call into real, already-deployed Uniswap V3 contracts rather than a protocol the test suite deploys itself. To exercise that path faithfully, `hardhat.config.js` configures Hardhat's built-in network to fork mainnet:

```js
networks: {
  hardhat: {
    forking: {
      url: secret.url, // a mainnet RPC endpoint, supplied via gitignored secret.json
    },
  },
  ...
}
```

Running `npx hardhat test` spins up an in-memory chain that starts from real, current mainnet state — meaning WETH, the Uniswap V3 factory, the position manager, and the swap router all exist and behave exactly as they do in production, with no mocking required.

---

## What's Covered

Two test files live in `tests/`:

**`market_graduation_tests.js`** — the core lifecycle test. It deploys `ProtocolRewards`, `BondingCurve`, the `Bag` implementation, `BagFactoryImpl`, and the `BagFactory` proxy against the forked chain (using real mainnet addresses for WETH and the Uniswap V3 position manager / swap router), then:
- Deploys a test agent token through the factory and confirms deployment.
- Buys a small amount (0.02 ETH) against the bonding curve and decodes the resulting `BagTokenBuy` event to check fee, cost, and order-size fields.
- Buys a large amount (10 ETH) — enough to exhaust the 800M-token primary supply — and confirms a `BagMarketGraduated` event fires with the pool address, ETH liquidity moved, secondary supply minted, and LP position ID.
- Performs a follow-up buy against the now-graduated Uniswap V3 pool (`expectedMarketType = 1`) and confirms it succeeds and emits a further `BagTokenBuy` event, proving the post-graduation trading path actually works end-to-end on a forked mainnet pool.

**`amendment_tests.js`** — covers the same deployment path, plus:
- A dedicated test that calls `upgradeParameters(0,0,0,0,0,0,0,0,0,0)` on a live token and reads every constant back, confirming the owner escape hatch documented on the [Bag Token](/projects/BasedAgents/contracts/bag-token) page genuinely mutates on-chain state rather than being a no-op.
- The same bonding-curve-buy → graduation → post-graduation-buy sequence as the graduation test file, effectively re-verifying the lifecycle under a second scenario name.

---

## Deployment Scripts

Two scripts in `scripts/` (`sepolia_deployment.js` and `governance_deployment.js`) mirror the same deployment sequence exercised by the tests, but target the `sepolia` network defined in `hardhat.config.js` (which reads a private key and RPC URL from the same `secret.json` file) rather than a local fork. The repository's README documents all six resulting Sepolia contract addresses and states they are verified on Etherscan.
