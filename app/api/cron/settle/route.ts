import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

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
          { name: "sig1", type: "bytes" },
          { name: "sig2", type: "bytes" },
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

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;
const PRIVATE_KEY = process.env.SETTLER_PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get completed but unsettled games
    const { data: games, error } = await supabase
      .from("games")
      .select("*")
      .eq("status", "completed")
      .is("settlement_tx_hash", null)
      .not("player1_signature", "is", null)
      .not("player2_signature", "is", null)
      .limit(50);

    if (error || !games || games.length === 0) {
      return NextResponse.json({ settled: 0 });
    }

    if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
      console.log("Skipping settlement - missing config");
      return NextResponse.json({ settled: 0, reason: "no_config" });
    }

    // Prepare settlements
    const settlements = games.map((game: any) => ({
      gameId: game.game_id.replace(/-/g, "") as `0x${string}`,
      winner: game.winner_id as `0x${string}`,
      loser: game.loser_id as `0x${string}`,
      stake: parseEther(game.stake.toString()),
      sig1: game.player1_signature as `0x${string}`,
      sig2: game.player2_signature as `0x${string}`,
    }));

    // Setup clients
    const account = privateKeyToAccount(PRIVATE_KEY);
    const publicClient = createPublicClient({
      chain: base,
      transport: http(RPC_URL),
    });
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(RPC_URL),
    });

    // Submit batch settlement
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "batchSettle",
      args: [settlements],
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Update games as settled
    const gameIds = games.map((g: any) => g.id);
    await supabase
      .from("games")
      .update({
        status: "settled",
        settlement_tx_hash: receipt.transactionHash,
        settled_at: new Date().toISOString(),
      })
      .in("id", gameIds);

    // Update user stats
    for (const game of games) {
      await supabase.rpc("increment_user_wins", { user_id: game.winner_id });
      await supabase.rpc("increment_user_losses", { user_id: game.loser_id });
    }

    return NextResponse.json({
      settled: games.length,
      txHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error("Settlement error:", error);
    return NextResponse.json(
      { error: "Settlement failed", details: String(error) },
      { status: 500 }
    );
  }
}

