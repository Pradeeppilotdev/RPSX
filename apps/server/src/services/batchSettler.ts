import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { sql } from "../db/init";

const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const PRIVATE_KEY = process.env.SETTLER_PRIVATE_KEY || "";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;

// Contract ABI (simplified)
const ABI = [
  {
    inputs: [
      {
        components: [
          { name: "gameId", type: "bytes32" },
          { name: "winner", type: "address" },
          { name: "loser", type: "address" },
          { name: "stake", type: "uint256" },
          { name: "signature1", type: "bytes" },
          { name: "signature2", type: "bytes" },
        ],
        name: "settlements",
        type: "tuple[]",
      },
    ],
    name: "batchSettle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function startBatchSettler() {
  console.log("🔄 Batch settler started");

  // Run every 10 minutes
  setInterval(async () => {
    try {
      await settleBatch();
    } catch (error) {
      console.error("❌ Batch settlement failed:", error);
    }
  }, 10 * 60 * 1000);

  // Also run immediately
  setTimeout(settleBatch, 5000);
}

async function settleBatch() {
  if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.log("⏭️  Batch settler skipped (no config)");
    return;
  }

  // Get pending settlements
  const games = await sql`
    SELECT 
      id,
      player1_address,
      player2_address,
      stake,
      winner,
      signature1,
      signature2
    FROM games
    WHERE status = 'finished'
      AND settled = false
      AND signature1 IS NOT NULL
      AND signature2 IS NOT NULL
    ORDER BY finished_at ASC
    LIMIT 20
  `;

  if (games.length === 0) {
    console.log("✅ No pending settlements");
    return;
  }

  console.log(`📦 Settling ${games.length} games...`);

  // Prepare settlements
  const settlements = games.map((game) => ({
    gameId: game.id.replace(/-/g, "") as `0x${string}`,
    winner: game.winner as `0x${string}`,
    loser:
      (game.winner === game.player1_address
        ? game.player2_address
        : game.player1_address) as `0x${string}`,
    stake: parseEther(game.stake.toString()),
    signature1: game.signature1 as `0x${string}`,
    signature2: game.signature2 as `0x${string}`,
  }));

  // Setup clients
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(RPC_URL),
  });

  try {
    // Estimate gas
    const gas = await publicClient.estimateGas({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "batchSettle",
      args: [settlements],
      account,
    });

    console.log(`⛽ Estimated gas: ${gas.toString()}`);

    // Submit transaction
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "batchSettle",
      args: [settlements],
      gas,
    });

    console.log(`📝 Transaction submitted: ${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Batch settled: ${receipt.transactionHash}`);

    // Update database
    for (const game of games) {
      await sql`
        UPDATE games
        SET settled = true, settlement_tx_hash = ${receipt.transactionHash}, settled_at = NOW()
        WHERE id = ${game.id}
      `;
    }

    // Update user stats
    for (const game of games) {
      const winner = game.winner;
      const loser =
        game.winner === game.player1_address
          ? game.player2_address
          : game.player1_address;

      await sql`
        UPDATE users
        SET 
          total_wins = total_wins + 1,
          total_earnings = total_earnings + ${game.stake * 1.94},
          win_streak = win_streak + 1,
          updated_at = NOW()
        WHERE address = ${winner}
      `;

      await sql`
        UPDATE users
        SET 
          total_losses = total_losses + 1,
          win_streak = 0,
          updated_at = NOW()
        WHERE address = ${loser}
      `;
    }
  } catch (error) {
    console.error("❌ Settlement transaction failed:", error);
    throw error;
  }
}

