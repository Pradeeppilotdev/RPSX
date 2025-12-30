import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const { gameId } = params;

    if (!gameId) {
      return NextResponse.json(
        { error: "Game ID is required" },
        { status: 400 }
      );
    }

    // Get game from DB
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select(`
        *,
        player1:users!games_player1_id_fkey(wallet_address),
        player2:users!games_player2_id_fkey(wallet_address)
      `)
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    // Format response
    const rounds = (game.rounds as any[]) || [];
    const currentRound = game.current_round || 1;
    const currentRoundData = rounds[currentRound - 1] || null;

    // Map database status to frontend status
    let frontendStatus = "lobby";
    if (game.status === "in_progress") {
      frontendStatus = "playing";
    } else if (game.status === "completed") {
      frontendStatus = "finished";
    } else if (game.status === "pending") {
      frontendStatus = "lobby";
    }

    return NextResponse.json({
      id: game.id,
      player1: (game.player1 as any)?.wallet_address || game.player1_id,
      player2: (game.player2 as any)?.wallet_address || game.player2_id,
      stake: parseFloat(game.stake || "0"),
      status: frontendStatus,
      rounds: rounds,
      player1Score: game.player1_score || 0,
      player2Score: game.player2_score || 0,
      currentRound: currentRound - 1, // 0-indexed for frontend
      currentRoundData: currentRoundData,
      createdAt: game.created_at,
      finishedAt: game.completed_at,
      winner: game.winner_id ? (game.winner_id === game.player1_id ? "player1" : "player2") : null,
    });
  } catch (error) {
    console.error("Get game error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

