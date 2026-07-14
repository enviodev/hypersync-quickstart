import { keccak256, toHex } from "viem";
import {
  HypersyncClient,
  LogField,
  JoinMode,
  BlockField,
  TransactionField,
  HexOutput,
  DataType,
  Decoder,
} from "@envio-dev/hypersync-client";

// Define Uniswap V3 event signatures
const event_signatures = [
  "Swap(address,address,int256,int256,uint160,uint128,int24)",
];

// Create topic0 hashes from event signatures
const topic0_list = event_signatures.map((sig) => keccak256(toHex(sig)));

// Initialize Hypersync client (API token required: https://docs.envio.dev/docs/HyperSync/api-tokens)
const client = new HypersyncClient({
  url: "https://unichain.hypersync.xyz",
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

  // Create decoder outside the loop for better performance
  const decoder = Decoder.fromSignatures([
    "Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
  ]);

  let totalEvents = 0;
  let totalAmount0 = BigInt(0);
  let totalAmount1 = BigInt(0);
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

      // Decode logs
      const decodedLogs = await decoder.decodeLogs(res.data.logs);

      // Track if we've printed an event for this batch
      let printedEventThisBatch = false;

      // Process swap events
      for (const log of decodedLogs) {
        // Skip invalid logs
        if (log === null) {
          continue;
        }

        // Access the decoded values directly without using JSON.stringify
        try {
          // Get sender and recipient from indexed parameters
          const sender = log.indexed[0]?.val.toString() || "unknown";
          const recipient = log.indexed[1]?.val.toString() || "unknown";

          // Get other parameters from body
          const amount0 = log.body[0]?.val || BigInt(0);
          const amount1 = log.body[1]?.val || BigInt(0);
          const sqrtPriceX96 = log.body[2]?.val?.toString() || "unknown";
          const liquidity = log.body[3]?.val?.toString() || "unknown";
          const tick = log.body[4]?.val?.toString() || "unknown";

          // Track total amounts for statistics
          totalAmount0 += amount0;
          totalAmount1 += amount1;

          // Print details for just the first swap event in each batch
          if (!printedEventThisBatch) {
            console.log(
              "\nSample Swap Event from Block " + res.nextBlock + ":"
            );
            console.log(`  Sender: ${sender}`);
            console.log(`  Recipient: ${recipient}`);
            console.log(`  Amount0: ${amount0.toString()}`);
            console.log(`  Amount1: ${amount1.toString()}`);
            console.log(`  SqrtPriceX96: ${sqrtPriceX96}`);
            console.log(`  Liquidity: ${liquidity}`);
            console.log(`  Tick: ${tick}`);

            // Mark that we've printed an event for this batch
            printedEventThisBatch = true;
          }
        } catch (error) {
          console.log("Error processing swap event:", error.message);
        }
      }
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
  console.log(`Total Amount0: ${totalAmount0.toString()}`);
  console.log(`Total Amount1: ${totalAmount1.toString()}`);
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
