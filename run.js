import { keccak256, toHex } from "viem";
import {
  HypersyncClient,
  Decoder,
  LogField,
  JoinMode,
  BlockField,
  TransactionField,
} from "@envio-dev/hypersync-client";

//=============================================================================
// HYPERSYNC CONFIGURATION
//=============================================================================

// Initialize Hypersync client (API token required: https://docs.envio.dev/docs/HyperSync/api-tokens)
const client = new HypersyncClient({
  url: "https://eth.hypersync.xyz",
  apiToken: process.env.ENVIO_API_TOKEN,
});

// Define Uniswap V3 event signatures we want to track
const event_signatures = [
  "PoolCreated(address,address,uint24,int24,address)",
  "Burn(address,int24,int24,uint128,uint256,uint256)",
  "Initialize(uint160,int24)",
  "Mint(address,address,int24,int24,uint128,uint256,uint256)",
  "Swap(address,address,int256,int256,uint160,uint128,int24)",
];

// Create topic0 hashes from event signatures
const topic0_list = event_signatures.map((sig) => keccak256(toHex(sig)));

// Define the Hypersync query to get events we're interested in
let query = {
  fromBlock: 0,
  logs: [
    {
      // Get all events that have any of the topic0 values we want
      topics: [topic0_list],
    },
  ],
  fieldSelection: {
    // Uncomment these fields if you need block data
    // block: [BlockField.Number, BlockField.Timestamp, BlockField.Hash],
    log: [
      // Uncomment these fields if you need more log data
      // LogField.BlockNumber,
      // LogField.LogIndex,
      // LogField.TransactionIndex,
      // LogField.TransactionHash,
      // LogField.Data,
      // LogField.Address,
      LogField.Topic0,
      // LogField.Topic1,
      // LogField.Topic2,
      // LogField.Topic3,
    ],
    // Uncomment these fields if you need transaction data
    // transaction: [
    //   TransactionField.From,
    //   TransactionField.To,
    //   TransactionField.Hash,
    //   TransactionField.Value,
    // ],
  },
  joinMode: JoinMode.JoinTransactions,
};

//=============================================================================
// UI CONFIGURATION AND HELPER FUNCTIONS
//=============================================================================

// UI configuration options
const CONFIG = {
  updateFrequency: 20000, // Update event counts every N blocks
  showDecodedLogs: false, // Set to true to show sample decoded logs
};

// Function to create a simple ASCII progress bar
const createProgressBar = (percentage, width = 40) => {
  const filledWidth = Math.round(width * percentage);
  const emptyWidth = width - filledWidth;
  const filledBar = "█".repeat(filledWidth);
  const emptyBar = "░".repeat(emptyWidth);
  return `[${filledBar}${emptyBar}] ${(percentage * 100).toFixed(2)}%`;
};

// Function to clear the console line
const clearLine = () => {
  process.stdout.write("\r\x1b[K");
};

// Function to format numbers with commas
const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

//=============================================================================
// MAIN FUNCTION
//=============================================================================

const main = async () => {
  // Count events by type
  const eventCounts = {
    PoolCreated: 0,
    Burn: 0,
    Initialize: 0,
    Mint: 0,
    Swap: 0,
    Unknown: 0,
    Total: 0,
  };

  const startTime = performance.now();
  let lastBlockUpdate = 0;

  console.log("Uniswap V3 Event Tracker");
  console.log("Tracking events: PoolCreated, Burn, Initialize, Mint, Swap");

  try {
    //=========================================================================
    // STEP 1: Get blockchain height using Hypersync
    //=========================================================================
    const height = await client.getHeight();
    console.log(
      `Starting scan from block 0 to current height: ${formatNumber(height)}`
    );
    console.log("Beginning blockchain scan...\n");

    //=========================================================================
    // STEP 2: Create a decoder for the event signatures
    //=========================================================================
    const decoder = Decoder.fromSignatures(event_signatures);

    //=========================================================================
    // STEP 3: Stream events from Hypersync
    //=========================================================================
    const stream = await client.stream(query, {});

    //=========================================================================
    // STEP 4: Process streaming data
    //=========================================================================
    while (true) {
      // Get the next batch of data from Hypersync
      const res = await stream.recv();

      // Quit if we reached the tip of the blockchain
      if (res === null) {
        console.log(`\nReached the tip of the blockchain!`);
        break;
      }

      // Process logs if any exist in this batch
      if (res.data && res.data.logs && res.data.logs.length > 0) {
        // Process logs based on their topic0 value
        res.data.logs.forEach((log) => {
          eventCounts.Total++;

          if (!log.topics || !log.topics[0]) {
            eventCounts.Unknown++;
            return;
          }

          const topic0 = log.topics[0];

          // Match topic0 to determine event type
          if (topic0 === topic0_list[0]) {
            eventCounts.PoolCreated++;
          } else if (topic0 === topic0_list[1]) {
            eventCounts.Burn++;
          } else if (topic0 === topic0_list[2]) {
            eventCounts.Initialize++;
          } else if (topic0 === topic0_list[3]) {
            eventCounts.Mint++;
          } else if (topic0 === topic0_list[4]) {
            eventCounts.Swap++;
          } else {
            eventCounts.Unknown++;
          }
        });

        // Optionally decode logs using Hypersync's Decoder
        if (CONFIG.showDecodedLogs) {
          const decodedLogs = await decoder.decodeLogs(res.data.logs);
          if (decodedLogs && decodedLogs.length > 0) {
            console.log("\nSample decoded log:");
            console.log(decodedLogs[0]);
          }
        }
      }

      // Update the fromBlock for the next iteration - this tells Hypersync where to continue from
      if (res.nextBlock) {
        query.fromBlock = res.nextBlock;
      }

      //=======================================================================
      // UI: Display progress (this is just for visualization, not core Hypersync functionality)
      //=======================================================================

      const currentTime = performance.now();
      const seconds = (currentTime - startTime) / 1000;

      // Calculate progress percentage
      const progress = res.nextBlock / height;

      // Clear the previous line and print the progress bar
      clearLine();
      process.stdout.write(
        `${createProgressBar(progress)} Block: ${formatNumber(
          res.nextBlock
        )}/${formatNumber(height)} | ` +
          `Events: ${formatNumber(eventCounts.Total)} | ` +
          `Time: ${seconds.toFixed(1)}s | ` +
          `Speed: ${formatNumber(Math.round(eventCounts.Total / seconds))}/s`
      );

      // Print event counts less frequently to reduce console spam
      if (res.nextBlock - lastBlockUpdate >= CONFIG.updateFrequency) {
        console.log("\n");
        console.log(`Event counts at block ${formatNumber(res.nextBlock)}:`);
        console.log(`- PoolCreated: ${formatNumber(eventCounts.PoolCreated)}`);
        console.log(`- Burn: ${formatNumber(eventCounts.Burn)}`);
        console.log(`- Initialize: ${formatNumber(eventCounts.Initialize)}`);
        console.log(`- Mint: ${formatNumber(eventCounts.Mint)}`);
        console.log(`- Swap: ${formatNumber(eventCounts.Swap)}`);
        console.log(`- Unknown: ${formatNumber(eventCounts.Unknown)}`);
        console.log("");

        lastBlockUpdate = res.nextBlock;
      }
    }

    //=========================================================================
    // Final summary
    //=========================================================================
    const totalTime = (performance.now() - startTime) / 1000;

    console.log("\n--- Final Event Summary ---");
    console.log(`Total Events: ${formatNumber(eventCounts.Total)}`);
    console.log(`PoolCreated: ${formatNumber(eventCounts.PoolCreated)}`);
    console.log(`Initialize: ${formatNumber(eventCounts.Initialize)}`);
    console.log(`Mint: ${formatNumber(eventCounts.Mint)}`);
    console.log(`Burn: ${formatNumber(eventCounts.Burn)}`);
    console.log(`Swap: ${formatNumber(eventCounts.Swap)}`);
    console.log(`Unknown: ${formatNumber(eventCounts.Unknown)}`);
    console.log(`Total processing time: ${totalTime.toFixed(2)} seconds`);
    console.log(
      `Average speed: ${formatNumber(
        Math.round(eventCounts.Total / totalTime)
      )} events/second`
    );
  } catch (error) {
    console.error("\nError during execution:", error);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("Error in main:", error);
  process.exit(1);
});
