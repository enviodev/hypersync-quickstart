import { keccak256, toHex, formatUnits } from "viem";
import {
  HypersyncClient,
  Decoder,
  LogField,
  JoinMode,
  BlockField,
  TransactionField,
} from "@envio-dev/hypersync-client";
import blessed from "blessed";
import contrib from "blessed-contrib";
import chalk from "chalk";
import figlet from "figlet";

//=============================================================================
// MULTI-CHAIN LIQUIDATION TRACKER CONFIGURATION
//=============================================================================

// Define liquidation event signature (without indexed keywords for topic0 hash)
const liquidation_signature =
  "LiquidationCall(address,address,address,uint256,uint256,address,bool)";

// Create topic0 hash for liquidation events
const liquidation_topic0 = keccak256(toHex(liquidation_signature));

// Multi-chain configuration
const chains = [
  {
    id: 1,
    name: "Ethereum",
    url: "https://1.hypersync.xyz",
    address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    color: "#627EEA",
    symbol: "ETH",
  },
  {
    id: 10,
    name: "Optimism",
    url: "https://10.hypersync.xyz",
    address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    color: "#FF0420",
    symbol: "OP",
  },
  {
    id: 42161,
    name: "Arbitrum",
    url: "https://42161.hypersync.xyz",
    address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    color: "#12AAFF",
    symbol: "ARB",
  },
  {
    id: 137,
    name: "Polygon",
    url: "https://137.hypersync.xyz",
    address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    color: "#8247E5",
    symbol: "MATIC",
  },
  {
    id: 8453,
    name: "Base",
    url: "https://8453.hypersync.xyz",
    address: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    color: "#0052FF",
    symbol: "BASE",
  },
  {
    id: 100,
    name: "Gnosis",
    url: "https://100.hypersync.xyz",
    address: "0xb50201558B00496A145fE76f7424749556E326D8",
    color: "#04795B",
    symbol: "xDAI",
  },
  {
    id: 59144,
    name: "Linea",
    url: "https://59144.hypersync.xyz",
    address: "0xc47b8C00b0f69a36fa203Ffeac0334874574a8Ac",
    color: "#000000",
    symbol: "LINEA",
  },
  {
    id: 534352,
    name: "Scroll",
    url: "https://534352.hypersync.xyz",
    address: "0x11fCfe756c05AD438e312a7fd934381537D3cFfe",
    color: "#FFEEDA",
    symbol: "SCROLL",
  },
  {
    id: 43114,
    name: "Avalanche",
    url: "https://43114.hypersync.xyz",
    address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    color: "#E84142",
    symbol: "AVAX",
  },
  {
    id: 56,
    name: "BSC",
    url: "https://56.hypersync.xyz",
    address: "0x6807dc923806fE8Fd134338EABCA509979a7e0cB",
    color: "#F3BA2F",
    symbol: "BNB",
  },
];

// Initialize Hypersync clients for each chain
const clients = {};
const streams = {};
const queries = {};

chains.forEach((chain) => {
  clients[chain.id] = HypersyncClient.new({ url: chain.url });

  queries[chain.id] = {
    fromBlock: 0,
    logs: [
      {
        address: [chain.address],
        topics: [[liquidation_topic0]],
      },
    ],
    fieldSelection: {
      log: [
        LogField.BlockNumber,
        LogField.TransactionHash,
        LogField.Address,
        LogField.Topic0,
        LogField.Topic1,
        LogField.Topic2,
        LogField.Topic3,
        LogField.Data,
      ],
      transaction: [TransactionField.Hash, TransactionField.BlockNumber],
    },
    joinMode: JoinMode.JoinTransactions,
  };
});

//=============================================================================
// TUI SETUP
//=============================================================================

// Format numbers with commas
const formatNumber = (num) => {
  if (num === null || num === undefined) return "0";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Format large numbers
const formatLargeNumber = (value) => {
  if (value >= 1e18) return `${(value / 1e18).toFixed(2)}E`;
  if (value >= 1e15) return `${(value / 1e15).toFixed(2)}P`;
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return formatNumber(value);
};

// Safe JSON stringify that handles circular references and truncates long strings
const safeStringify = (obj, maxLength = 100) => {
  try {
    if (!obj) return "null";
    const str = JSON.stringify(obj);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + "...";
  } catch (err) {
    return `[Object: stringify failed]`;
  }
};

// Create blessed screen
const screen = blessed.screen({
  smartCSR: true,
  title: "🔥 Multi-Chain Liquidation Tracker - Powered by Hypersync 🔥",
  dockBorders: true,
  fullUnicode: true,
});

// Define UI color scheme - more dramatic colors
const uiColor = "#FF6B35"; // Fiery orange for liquidations
const accentColor = "#F7931E"; // Bitcoin orange
const dangerColor = "#DC143C"; // Crimson red
const successColor = "#32CD32"; // Lime green

// Create a grid layout
const grid = new contrib.grid({
  rows: 12,
  cols: 12,
  screen: screen,
});

// Create ASCII logo with liquidation theme
const logo = grid.set(0, 0, 3, 12, blessed.box, {
  content: chalk.hex(uiColor)(
    figlet.textSync("LIQUIDATOR", {
      font: "Slant",
      horizontalLayout: "full",
    })
  ),
  tags: true,
  align: "center",
  valign: "middle",
  border: {
    type: "line",
    fg: uiColor,
  },
});

// Create subtitle with liquidation theme
const subtitle = grid.set(3, 0, 1, 12, blessed.box, {
  content: chalk.hex(dangerColor)(
    " 🔥 MULTI-CHAIN LIQUIDATION HUNTER 🔥 - Real-time DeFi Liquidations "
  ),
  tags: true,
  align: "center",
  valign: "middle",
  style: {
    fg: dangerColor,
    bold: true,
  },
});

// Create global stats display (smaller since chain activity is bigger)
const globalStats = grid.set(3, 0, 1, 12, blessed.box, {
  label: " 💰 Global Liquidation Stats ",
  tags: true,
  border: {
    type: "line",
    fg: uiColor,
  },
  style: {
    fg: "white",
  },
});

// Create chain activity display - much bigger and full width
const chainActivity = grid.set(4, 0, 4, 12, blessed.box, {
  label: " ⛓️  Chain Activity - Live Liquidation Tracking ",
  tags: true,
  border: {
    type: "line",
    fg: uiColor,
  },
  style: {
    fg: "white",
  },
});

// Create crying Pepe with liquidation stats (left side)
const pepeBox = grid.set(8, 0, 4, 6, blessed.box, {
  label: " 😭 Crying Pepe's Liquidation Tears ",
  tags: true,
  border: {
    type: "line",
    fg: dangerColor,
  },
  style: {
    fg: "white",
  },
});

// Create scanning activity log (right side)
const scanningLog = grid.set(8, 6, 4, 6, contrib.log, {
  label: " 📡 Live Liquidation Scanner ",
  tags: true,
  border: {
    type: "line",
    fg: uiColor,
  },
  style: {
    fg: "cyan",
  },
  bufferLength: 50,
});

// Activity log that uses the UI box instead of console
const activityLog = {
  log: (message) => {
    try {
      scanningLog.log(message);
      screen.render(); // Ensure screen updates after log messages
    } catch (err) {
      console.log(message); // Fallback to console if UI fails
    }
  },
};

// Exit on Escape, q, or Ctrl+C
screen.key(["escape", "q", "C-c"], function (ch, key) {
  return process.exit(0);
});

// Update global stats display (compact single line)
const updateGlobalStats = (globalData) => {
  try {
    const content = [
      `${chalk.hex(dangerColor)("🔥 Liquidations")}: ${chalk.bold.white(
        formatNumber(globalData.totalLiquidations)
      )}`,
      `${chalk.hex(successColor)("💰 Debt Covered")}: ${chalk.bold.green(
        formatLargeNumber(globalData.totalDebtCovered)
      )}`,
      `${chalk.hex(uiColor)("🏃 Active Chains")}: ${chalk.bold.cyan(
        globalData.activeChains
      )}`,
      `${chalk.hex("#9966CC")("⏰ Runtime")}: ${chalk.bold.magenta(
        globalData.runtime
      )}`,
    ].join("   |   ");

    globalStats.setContent(content);
  } catch (err) {
    activityLog.log(`Global stats update error: ${err.message}`);
  }
};

// Update chain activity display with smoother bars (fixed formatting)
const updateChainActivity = (chainData) => {
  try {
    const sortedChains = Object.entries(chainData).sort(
      (a, b) => b[1].count - a[1].count
    );

    const maxCount = Math.max(
      ...Object.values(chainData).map((d) => d.count),
      1
    );

    const content = sortedChains
      .map(([chainId, data]) => {
        const chain = chains.find((c) => c.id === parseInt(chainId));
        if (!chain) return "";

        const activity = data.count > 0 ? "🔥" : "⚪";
        const percentage = data.count / maxCount;
        const barLength = Math.max(0, Math.round(percentage * 30)); // Shorter bars for better fit

        // Use gradient characters for smoother bars
        const fullBlocks = Math.floor(barLength);
        const remainder = barLength - fullBlocks;

        let bar = "";
        if (fullBlocks > 0) {
          bar = chalk.hex(chain.color)("█".repeat(fullBlocks));
        }
        if (remainder > 0.7) bar += chalk.hex(chain.color)("▋");
        else if (remainder > 0.4) bar += chalk.hex(chain.color)("▌");
        else if (remainder > 0.1) bar += chalk.hex(chain.color)("▎");

        // Ensure bar has minimum width for display
        if (bar.length === 0 && data.count > 0) {
          bar = chalk.hex(chain.color)("▎");
        }

        const liquidationsText =
          data.count === 1 ? "liquidation" : "liquidations";
        const percentageText =
          maxCount > 0
            ? `(${((data.count / maxCount) * 100).toFixed(1)}%)`
            : "(0%)";

        // Fixed formatting with proper spacing
        const chainName = chalk.hex(chain.color).bold(chain.name.padEnd(11));
        const countText = chalk.white.bold(
          formatNumber(data.count).padStart(5)
        );

        return `${activity} ${chainName}: ${bar} ${countText} ${chalk.gray(
          liquidationsText
        )} ${chalk.yellow(percentageText)}`;
      })
      .join("\n");

    chainActivity.setContent(content);
  } catch (err) {
    activityLog.log(`Chain activity update error: ${err.message}`);
  }
};

// Chart removed for cleaner display

// Update crying Pepe box with ASCII art and tears for each liquidation
const updatePepeBox = (globalData) => {
  try {
    const pepeArt = `    ░░░░░░░░░░░░░░░░░░░░░░
    ░░░░░░░░▄▄▄▄▄▄▄░░░░░░░
    ░░░░░▄▀░░░░░░░▀▄░░░░░░
    ░░░▄▀░░░░░░░░░░░▀▄░░░░
    ░░▄▀░░░░░░░░░░░░░░▀▄░░
    ░▐░░░░░░░░░░░░░░░░░░▌░
    ░▌░░░░░░░░░░░░░░░░░░▐░
    ░▌░░░░░░░░░░░░░░░░░░▐░
    ░▌░${chalk.blue("██")}░░░░░░░░░░░${chalk.blue("██")}░░▐░
    ░▌░░░░░░▄▄▄▄▄░░░░░░░░▐░
    ░▌░░░░░▐█▄▄▄█▌░░░░░░░▐░
    ░▐░░░░░░▀▄▄▄▀░░░░░░░░▌░
    ░░▀▄░░░░░░░░░░░░░░░▄▀░░
    ░░░░▀▄▄▄▄▄▄▄▄▄▄▄▄▄▀░░░░
    ░░░░░░░░░░░░░░░░░░░░░░░`;

    const painLevel =
      globalData.totalLiquidations > 100000
        ? chalk.red.bold("MAXIMUM PAIN")
        : globalData.totalLiquidations > 50000
        ? chalk.red("SEVERE PAIN")
        : globalData.totalLiquidations > 10000
        ? chalk.yellow("MODERATE PAIN")
        : globalData.totalLiquidations > 1000
        ? chalk.green("MILD PAIN")
        : chalk.cyan("MINOR PAIN");

    const stats = `💧 ${chalk.blue.bold("LIQUIDATION TEARS")} 💧

${chalk.yellow("Pain Level")}: ${painLevel}
${chalk.cyan("Liquidations")}: ${chalk.white.bold(
      formatNumber(globalData.totalLiquidations)
    )}
${chalk.green("Debt Covered")}: ${chalk.green.bold(
      formatLargeNumber(globalData.totalDebtCovered)
    )}`;

    // Create visual tears - one tear per liquidation up to 30 max for display (smaller box)
    const tearCount = Math.min(globalData.totalLiquidations, 30);
    const tears = chalk.blue("💧").repeat(tearCount);
    const tearDisplay =
      tearCount < globalData.totalLiquidations
        ? `${tears}${chalk.gray(
            ` (+${formatNumber(globalData.totalLiquidations - tearCount)})`
          )}`
        : tears || chalk.gray("No tears yet... 😢");

    const content = `${pepeArt}\n\n${stats}\n\n${chalk.blue.bold(
      "Tears Shed:"
    )}\n${tearDisplay}\n\n${chalk.red.bold("Each liquidation = 1 tear 😭")}`;

    pepeBox.setContent(content);
  } catch (err) {
    activityLog.log(`Pepe update error: ${err.message}`);
  }
};

// Format liquidation event for display
const formatLiquidation = (liquidation, chainInfo) => {
  try {
    const debtAmount = formatLargeNumber(liquidation.debtToCover || 0);
    const collateralAmount = formatLargeNumber(
      liquidation.liquidatedCollateralAmount || 0
    );
    const userShort = liquidation.user
      ? `${liquidation.user.slice(0, 6)}...${liquidation.user.slice(-4)}`
      : "Unknown";
    const liquidatorShort = liquidation.liquidator
      ? `${liquidation.liquidator.slice(0, 6)}...${liquidation.liquidator.slice(
          -4
        )}`
      : "Unknown";

    return `${chalk.hex(chainInfo.color)(`[${chainInfo.symbol}]`)} ${chalk.hex(
      dangerColor
    )("💥")} User: ${chalk.cyan(userShort)} | Debt: ${chalk.yellow(
      debtAmount
    )} | Collateral: ${chalk.green(
      collateralAmount
    )} | Liquidator: ${chalk.magenta(liquidatorShort)}`;
  } catch (err) {
    return `${chalk.red("Liquidation format error")}`;
  }
};

// Render the screen
screen.render();

//=============================================================================
// MULTI-CHAIN LIQUIDATION TRACKER MAIN FUNCTION
//=============================================================================

const main = async () => {
  const startTime = performance.now();

  // Global tracking data
  const globalData = {
    totalLiquidations: 0,
    totalDebtCovered: 0,
    activeChains: 0,
    runtime: "0s",
  };

  // Per-chain tracking data
  const chainData = {};
  chains.forEach((chain) => {
    chainData[chain.id] = {
      count: 0,
      debtCovered: 0,
      lastUpdate: 0,
      active: false,
    };
  });

  // Initialize decoder for liquidation events
  const decoder = Decoder.fromSignatures([liquidation_signature]);

  activityLog.log(
    chalk.hex(uiColor).bold("🚀 Initializing Multi-Chain Liquidation Hunter...")
  );
  activityLog.log(chalk.cyan("📡 Preparing to scan 10 blockchain networks..."));
  screen.render();

  try {
    // Initialize streams for all chains
    activityLog.log(chalk.cyan.bold("🔗 Connecting to Hypersync endpoints..."));
    screen.render();

    const streamPromises = [];

    for (const chain of chains) {
      try {
        activityLog.log(
          chalk.hex(chain.color)(
            `🔗 Connecting to ${chain.name} (${chain.id})...`
          )
        );
        screen.render();

        const stream = await clients[chain.id].stream(queries[chain.id], {});
        streams[chain.id] = stream;
        chainData[chain.id].active = true;

        activityLog.log(
          chalk.green(`✅ ${chain.name} connected and scanning!`)
        );
        screen.render();
      } catch (error) {
        activityLog.log(
          chalk.red(`❌ Failed to connect to ${chain.name}: ${error.message}`)
        );
        chainData[chain.id].active = false;
      }
    }

    globalData.activeChains = Object.values(chainData).filter(
      (d) => d.active
    ).length;
    activityLog.log(
      chalk.green.bold(
        `🎯 Connected to ${globalData.activeChains}/${chains.length} chains!`
      )
    );

    // Update subtitle with active status
    subtitle.setContent(
      chalk.hex(dangerColor)(
        ` 🔥 HUNTING LIQUIDATIONS ON ${globalData.activeChains} CHAINS 🔥 `
      )
    );
    screen.render();

    // Initialize UI displays
    updateGlobalStats(globalData);
    updateChainActivity(chainData);
    updatePepeBox(globalData);
    screen.render();

    // Main event processing loop
    activityLog.log(
      chalk.green.bold("🎯 Starting liquidation hunt across all chains...")
    );
    activityLog.log(
      chalk.blue("📊 Scanning for LiquidationCall events in real-time...")
    );
    let lastUpdate = Date.now();

    while (true) {
      let hasActivity = false;

      // Process events from all active chains
      for (const chain of chains) {
        if (!chainData[chain.id].active || !streams[chain.id]) continue;

        try {
          const res = await streams[chain.id].recv();

          if (res === null) {
            activityLog.log(
              chalk.yellow(`📡 ${chain.name}: Reached chain tip`)
            );
            continue;
          }

          if (res.nextBlock) {
            queries[chain.id].fromBlock = res.nextBlock;
            chainData[chain.id].lastUpdate = res.nextBlock;
          }

          // Process liquidation events
          if (res.data?.logs?.length > 0) {
            hasActivity = true;

            for (const log of res.data.logs) {
              if (!log || !log.topics || log.topics[0] !== liquidation_topic0)
                continue;

              globalData.totalLiquidations++;
              chainData[chain.id].count++;

              try {
                // Decode the liquidation event
                const decoded = await decoder.decodeLogs([log]);

                if (decoded && decoded[0] && decoded[0].event) {
                  const liquidation = decoded[0].event;

                  // Extract actual values from the decoded event
                  const debtToCover = BigInt(liquidation.debtToCover || 0);
                  const liquidatedCollateralAmount = BigInt(
                    liquidation.liquidatedCollateralAmount || 0
                  );

                  // Update global and chain-specific counters
                  globalData.totalDebtCovered += Number(debtToCover);
                  chainData[chain.id].debtCovered += Number(debtToCover);

                  // Display liquidation in feed
                  const liquidationDisplay = formatLiquidation(
                    {
                      debtToCover: Number(debtToCover),
                      liquidatedCollateralAmount: Number(
                        liquidatedCollateralAmount
                      ),
                      user: liquidation.user,
                      liquidator: liquidation.liquidator,
                    },
                    chain
                  );

                  // Log liquidation to scanning feed
                  activityLog.log(
                    `${chalk.hex(dangerColor)("💥")} ${chalk.hex(chain.color)(
                      `[${chain.symbol}]`
                    )} Liquidation: ${chalk.yellow(
                      formatLargeNumber(Number(debtToCover))
                    )} debt`
                  );

                  // Show major liquidations in activity log (debt > 1000 tokens in wei)
                  if (debtToCover > BigInt(1000) * BigInt(1e18)) {
                    activityLog.log(
                      chalk
                        .hex(dangerColor)
                        .bold(
                          `🚨 MAJOR LIQUIDATION on ${
                            chain.name
                          }: ${formatLargeNumber(
                            Number(debtToCover)
                          )} debt tokens!`
                        )
                    );
                  }
                }
              } catch (decodeError) {
                activityLog.log(
                  chalk.yellow(
                    `⚠️  Decode error on ${chain.name}: ${decodeError.message}`
                  )
                );
              }
            }

            // Log chain activity
            if (res.data.logs.length > 0) {
              activityLog.log(
                `${chalk.hex(chain.color)(
                  `[${chain.symbol}]`
                )} Block ${formatNumber(res.nextBlock)}: ${
                  res.data.logs.length
                } liquidations found`
              );
            } else {
              // Periodic scanning updates even when no liquidations found
              if (res.nextBlock % 10000 === 0) {
                activityLog.log(
                  `${chalk.gray(
                    `[${chain.symbol}]`
                  )} Scanning block ${formatNumber(res.nextBlock)}...`
                );
              }
            }
          }
        } catch (streamError) {
          activityLog.log(
            chalk.red(
              `❌ Stream error on ${chain.name}: ${streamError.message}`
            )
          );
          chainData[chain.id].active = false;
          globalData.activeChains = Object.values(chainData).filter(
            (d) => d.active
          ).length;
        }
      }

      // Update UI every few seconds
      const now = Date.now();
      if (now - lastUpdate > 2000) {
        // Update every 2 seconds
        const runtime = Math.floor((performance.now() - startTime) / 1000);
        globalData.runtime = `${Math.floor(runtime / 60)}m ${runtime % 60}s`;
        // Runtime calculation complete

        updateGlobalStats(globalData);
        updateChainActivity(chainData);
        updatePepeBox(globalData);

        lastUpdate = now;
      }

      screen.render();

      // Small delay to prevent overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    activityLog.log(chalk.red.bold(`💥 Fatal error: ${error.message}`));
    screen.render();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    process.exit(1);
  }
};

// Display initial splash screen
activityLog.log(
  chalk.hex(uiColor).bold("🔥 LIQUIDATION HUNTER INITIALIZING... 🔥")
);
activityLog.log(
  chalk.yellow("📡 Preparing to monitor DeFi liquidations across 10 chains")
);
activityLog.log(chalk.cyan("💡 Press Q to exit at any time"));
activityLog.log(chalk.white("━".repeat(40)));
screen.render();

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  try {
    activityLog.log(chalk.red(`💥 Unhandled error: ${error.message}`));
    screen.render();
  } catch (err) {
    console.error("Fatal error:", error);
  }
});

// Start the epic liquidation tracking application
main().catch((error) => {
  try {
    activityLog.log(chalk.red.bold(`💥 FATAL ERROR: ${error.message}`));
    activityLog.log(chalk.yellow("🔄 Restarting in 3 seconds..."));
    screen.render();
    setTimeout(() => process.exit(1), 3000);
  } catch (err) {
    console.error("Error in main:", error);
    process.exit(1);
  }
});
