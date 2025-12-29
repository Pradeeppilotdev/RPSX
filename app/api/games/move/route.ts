import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { triggerRoundResult, triggerMoveReceived } from "@/lib/pusher/server";

function determineWinner(
  move1: string,
  move2: string
): "player1" | "player2" | "draw" {
  if (move1 === move2) return "draw";

  if (
    (move1 === "rock" && move2 === "scissors") ||
    (move1 === "paper" && move2 === "rock") ||
    (move1 === "scissors" && move2 === "paper")
  ) {
    return "player1";
  }

  return "player2";
}

export async function POST(req: NextRequest) {
  try {
    const { gameId, move, playerId } = await req.json();

    if (!gameId || !move || !playerId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get user ID from wallet address
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("wallet_address", playerId)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get game from DB
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    // Get current round
    const rounds = (game.rounds as any[]) || [];
    const currentRoundIndex = (game.current_round || 1) - 1;
    let currentRound = rounds[currentRoundIndex];
    
    if (!currentRound) {
      currentRound = {
        roundNumber: game.current_round || 1,
        player1Move: null,
        player2Move: null,
        winner: null,
      };
      rounds[currentRoundIndex] = currentRound;
    }

    // Store move
    if (user.id === game.player1_id) {
      currentRound.player1Move = move;
    } else if (user.id === game.player2_id) {
      currentRound.player2Move = move;
    } else {
      return NextResponse.json(
        { error: "Not a player in this game" },
        { status: 403 }
      );
    }

    // Update rounds array
    rounds[currentRoundIndex] = currentRound;

    // Notify move received
    await triggerMoveReceived(gameId, {
      playerId,
      round: game.current_round,
    });

    // Check if both players moved
    if (currentRound.player1Move && currentRound.player2Move) {
      const winner = determineWinner(
        currentRound.player1Move,
        currentRound.player2Move
      );

      currentRound.winner = winner;

      // Update scores
      let player1Score = game.player1_score || 0;
      let player2Score = game.player2_score || 0;

      if (winner === "player1") {
        player1Score++;
      } else if (winner === "player2") {
        player2Score++;
      }

      // Update game in DB
      await supabase
        .from("games")
        .update({
          rounds: rounds as any,
          player1_score: player1Score,
          player2_score: player2Score,
          current_round: (game.current_round || 1) + 1,
        })
        .eq("id", gameId);

      // Check if game is over
      if (player1Score >= 3 || player2Score >= 3) {
        const winnerId = player1Score >= 3 ? game.player1_id : game.player2_id;
        const loserId = player1Score >= 3 ? game.player2_id : game.player1_id;

        await supabase
          .from("games")
          .update({
            status: "completed",
            winner_id: winnerId,
            loser_id: loserId,
            completed_at: new Date().toISOString(),
            rounds: rounds as any,
          })
          .eq("id", gameId);

        // Trigger game end
        await triggerRoundResult(gameId, {
          roundNumber: game.current_round,
          player1Move: currentRound.player1Move,
          player2Move: currentRound.player2Move,
          winner,
          player1Score,
          player2Score,
          gameEnd: true,
          winnerId,
          loserId,
        });
      } else {
        // Trigger round result
        await triggerRoundResult(gameId, {
          roundNumber: game.current_round,
          player1Move: currentRound.player1Move,
          player2Move: currentRound.player2Move,
          winner,
          player1Score,
          player2Score,
        });
      }
    } else {
      // Update DB with partial round
      await supabase
        .from("games")
        .update({ rounds: rounds as any })
        .eq("id", gameId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Move error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

