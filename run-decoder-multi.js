import { keccak256, toHex } from "viem";
import {
  HypersyncClient,
  LogField,
  JoinMode,
  TransactionField,
  Decoder,
} from "@envio-dev/hypersync-client";

// Initialize Hypersync client (API token required: https://docs.envio.dev/docs/HyperSync/api-tokens)
const client = new HypersyncClient({
  url: "https://eth.hypersync.xyz",
  apiToken: process.env.ENVIO_API_TOKEN,
});

// Define ERC20 event signatures for keccak256 hashing
const event_signatures = [
  "Transfer(address,address,uint256)",
  "Approval(address,address,uint256)",
];

// Create topic0 hashes from event signatures
const topic0_list = event_signatures.map((sig) => keccak256(toHex(sig)));

// Store individual topic hashes for reference
const TRANSFER_TOPIC = topic0_list[0];
const APPROVAL_TOPIC = topic0_list[1];

// Create mapping from topic0 hash to event name for easier reference
const topic0ToName = {
  [TRANSFER_TOPIC]: "Transfer",
  [APPROVAL_TOPIC]: "Approval",
};

// Define query to fetch ERC20 transfer and approval events
let query = {
  fromBlock: 17000000, // Starting from a recent block
  toBlock: 17000100, // Limiting to a small range for the example
  logs: [
    // Filter for Transfer and Approval events
    {
      topics: [[TRANSFER_TOPIC, APPROVAL_TOPIC]],
    },
  ],
  fieldSelection: {
    log: [
      LogField.BlockNumber,
      LogField.LogIndex,
      LogField.TransactionHash,
      LogField.Data,
      LogField.Address,
      LogField.Topic0,
      LogField.Topic1,
      LogField.Topic2,
      LogField.Topic3,
    ],
    transaction: [
      TransactionField.From,
      TransactionField.To,
      TransactionField.Hash,
    ],
  },
  joinMode: JoinMode.JoinTransactions, // Get transaction data for each log
};

const main = async () => {
  console.log("Starting multi-log decoding example...");

  // Create decoder with multiple event signatures
  // This is the key part for multi-log decoding
  const decoder = Decoder.fromSignatures([
    "Transfer(address indexed from, address indexed to, uint256 amount)",
    "Approval(address indexed owner, address indexed spender, uint256 amount)",
  ]);

  // Start streaming events
  const stream = await client.stream(query, {});
  let eventCount = 0;

  while (eventCount < 20) {
    // Limit processing to 20 events for the example
    const res = await stream.recv();

    // Exit if we've reached the end of the chain
    if (res === null) {
      console.log("Reached the tip of the blockchain");
      break;
    }

    // Process logs if available
    if (res.data && res.data.logs && res.data.logs.length > 0) {
      console.log(
        `\nProcessing ${res.data.logs.length} logs from block ${res.data.logs[0].blockNumber}:`
      );

      // Decode all logs in a single call - this is the key multi-decoding feature
      const decodedLogs = await decoder.decodeLogs(res.data.logs);

      // Process each decoded log
      for (let i = 0; i < decodedLogs.length; i++) {
        const decodedLog = decodedLogs[i];
        const rawLog = res.data.logs[i];

        // Skip invalid logs
        if (decodedLog === null) {
          console.log(`  Log #${i}: Unable to decode`);
          continue;
        }

        const topic0 = rawLog.topics[0];
        const eventName = topic0ToName[topic0] || "Unknown";
        const tokenAddress = rawLog.address;

        console.log(`  Log #${i} (${eventName}) from token ${tokenAddress}:`);

        // Access decoded data based on event type
        if (eventName === "Transfer") {
          // For Transfer events - get indexed parameters (from, to) and body parameter (amount)
          const from = decodedLog.indexed[0]?.val.toString() || "unknown";
          const to = decodedLog.indexed[1]?.val.toString() || "unknown";
          const amount = decodedLog.body[0]?.val.toString() || "0";

          console.log(`    From: ${from}`);
          console.log(`    To: ${to}`);
          console.log(`    Amount: ${amount}`);
        } else if (eventName === "Approval") {
          // For Approval events - get indexed parameters (owner, spender) and body parameter (amount)
          const owner = decodedLog.indexed[0]?.val.toString() || "unknown";
          const spender = decodedLog.indexed[1]?.val.toString() || "unknown";
          const amount = decodedLog.body[0]?.val.toString() || "0";

          console.log(`    Owner: ${owner}`);
          console.log(`    Spender: ${spender}`);
          console.log(`    Amount: ${amount}`);
        }

        eventCount++;
      }
    }

    // Update query for next batch
    if (res.nextBlock) {
      query.fromBlock = res.nextBlock;
    }
  }

  console.log("\nDecoding example complete!");
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
