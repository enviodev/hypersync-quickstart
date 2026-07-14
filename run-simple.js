import { keccak256, toHex } from "viem";
import {
  HypersyncClient,
  LogField,
  JoinMode,
  BlockField,
  TransactionField,
} from "@envio-dev/hypersync-client";

// Define Uniswap V3 event signatures
const event_signatures = [
  "PoolCreated(address,address,uint24,int24,address)",
  "Burn(address,int24,int24,uint128,uint256,uint256)",
  "Initialize(uint160,int24)",
  "Mint(address,address,int24,int24,uint128,uint256,uint256)",
  "Swap(address,address,int256,int256,uint160,uint128,int24)",
];

// Create topic0 hashes from event signatures
const topic0_list = event_signatures.map((sig) => keccak256(toHex(sig)));

// Initialize Hypersync client (API token required: https://docs.envio.dev/docs/HyperSync/api-tokens)
const client = new HypersyncClient({
  url: "https://eth.hypersync.xyz",
  apiToken: process.env.ENVIO_API_TOKEN,
});

// Define query for Uniswap V3 events
let query = {
  fromBlock: 0,
  logs: [
    {
      topics: [topic0_list],
    },
  ],
  fieldSelection: {
    // block: [BlockField.Number, BlockField.Timestamp, BlockField.Hash],
    log: [
      // LogField.BlockNumber,
      // LogField.LogIndex,
      // LogField.TransactionIndex,
      // LogField.TransactionHash,
      LogField.Data,
      LogField.Address,
      LogField.Topic0,
      LogField.Topic1,
      LogField.Topic2,
      LogField.Topic3,
    ],
    // transaction: [
    //   TransactionField.From,
    //   TransactionField.To,
    //   TransactionField.Hash,
    //   TransactionField.Value,
    // ],
  },
  joinMode: JoinMode.JoinTransactions,
};

const main = async () => {
  console.log("Starting Uniswap V3 event scan...");

  let totalEvents = 0;
  const startTime = performance.now();

  // Start streaming events
  const stream = await client.stream(query, {});

  while (true) {
    const res = await stream.recv();

    // Exit if we've reached the end of the chain
    if (res === null) {
      console.log("Reached the tip of the blockchain");
      break;
    }

    // Count total events
    if (res.data && res.data.logs) {
      totalEvents += res.data.logs.length;
    }

    // Update query for next batch
    if (res.nextBlock) {
      query.fromBlock = res.nextBlock;
    }

    // Calculate and print simple progress metrics
    const seconds = (performance.now() - startTime) / 1000;

    console.log(
      `Block ${res.nextBlock} | ${totalEvents} events | ${seconds.toFixed(
        1
      )}s | ${(totalEvents / seconds).toFixed(1)} events/s`
    );
  }

  // Print final results
  const totalTime = (performance.now() - startTime) / 1000;
  console.log(
    `\nScan complete: ${totalEvents} events in ${totalTime.toFixed(1)} seconds`
  );
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
