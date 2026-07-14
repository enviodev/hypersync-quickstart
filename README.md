# Hypersync Quickstart

Minimal examples showing how to use HyperSync to stream blockchain events from Uniswap V3.

## Prerequisites

- Node.js
- pnpm (or npm)
- An Envio API token ([get one here](https://docs.envio.dev/docs/HyperSync/api-tokens))

API tokens have been required since 3 Nov 2025. Set yours before running:

```bash
export ENVIO_API_TOKEN="your-token-here"
```

## How to run

```bash
# Install dependencies
pnpm i

# Run minimal version (recommended for beginners)
node run-simple.js

# Run full version with UI
node run.js

# Run version with interactive terminal dashboard
node run-tui.js

# Run single event decoder example (Uniswap V3 swaps)
node run-decoder.js

# Run multi-event decoder example (ERC20 Transfer and Approval events)
node run-decoder-multi.js
```

The scripts stream events from Ethereum mainnet (or Unichain for `run-decoder.js`) and display progress as they scan.

> **Note:** To use other networks, change the `url` passed to `new HypersyncClient({ url, apiToken })`. See [supported networks](https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks).

## Example Files

- `run.js` - Main example with UI for tracking Uniswap V3 events
- `run-simple.js` - Simplified version for beginners
- `run-tui.js` - Example with interactive terminal dashboard
- `run-decoder.js` - Shows how to use HyperSync's decoder to parse Uniswap V3 swap events
- `run-decoder-multi.js` - Demonstrates decoding multiple event types (ERC20 Transfer and Approval)

## Documentation

- [HyperSync overview](https://docs.envio.dev/docs/HyperSync/overview)
- [API tokens](https://docs.envio.dev/docs/HyperSync/api-tokens)
- [Supported networks](https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks)
