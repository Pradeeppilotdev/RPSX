import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { triggerMatchFound, triggerQueued, triggerRoundStart } from "@/lib/pusher/server";

export async function POST(req: NextRequest) {
  try {
    const { stake, playerId } = await req.json();

    if (!stake || !playerId) {
      return NextResponse.json(
        { error: "Missing stake or playerId" },
        { status: 400 }
      );
    }

    // First, get current user to exclude their own pending games
    const { data: currentUser } = await supabase
      .from("users")
      .select("id")
      .eq("wallet_address", playerId)
      .single();
    
    // Check for waiting opponent in queue (exclude current player's own games)
    const stakeStr = stake.toString();
    
    let query = supabase
      .from("games")
      .select("*")
      .eq("status", "pending")
      .eq("stake", stakeStr)
      .is("player2_id", null)
      .order("created_at", { ascending: true })
      .limit(1);
    
    // Exclude games where current user is player1 (prevent self-matching)
    if (currentUser?.id) {
      query = query.neq("player1_id", currentUser.id);
    }
    
    const { data: waitingGames, error: waitingError } = await query;
    
    if (waitingError) {
      console.error("Error checking for waiting games:", waitingError);
      return NextResponse.json(
        { error: `Database error: ${waitingError.message}` },
        { status: 500 }
      );
    }
    
    const waitingGame = waitingGames && waitingGames.length > 0 ? waitingGames[0] : null;

    if (waitingGame) {
      // Found a match! Get or create user for player2
      const { data: user2 } = await supabase
        .from("users")
        .select("id")
        .eq("wallet_address", playerId)
        .single();
      
      let player2UserId = user2?.id;
      if (!player2UserId) {
        // Use 0 as default for non-Farcaster users (database requires NOT NULL)
        // If UNIQUE constraint exists, this may need to be changed to a unique value per user
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert({
            wallet_address: playerId,
            farcaster_fid: 0, // Default for non-Farcaster users (NOT NULL constraint)
            username: `Player_${playerId.slice(0, 6)}`,
          })
          .select()
          .single();
        
        if (createError) {
          console.error("Error creating user2:", createError);
          // If UNIQUE constraint violation, try with a unique negative value
          if (createError.code === '23505') {
            // Generate a unique negative FID based on wallet address hash
            const hashFid = -(Math.abs(playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 1000000);
            const { data: retryUser, error: retryError } = await supabase
              .from("users")
              .insert({
                wallet_address: playerId,
                farcaster_fid: hashFid,
                username: `Player_${playerId.slice(0, 6)}`,
              })
              .select()
              .single();
            
            if (retryError) {
              return NextResponse.json(
                { error: `Failed to create user: ${retryError.message}` },
                { status: 500 }
              );
            }
            player2UserId = retryUser?.id;
          } else {
            return NextResponse.json(
              { error: `Failed to create user: ${createError.message}` },
              { status: 500 }
            );
          }
        } else {
          player2UserId = newUser?.id;
        }
      }

      if (!player2UserId) {
        return NextResponse.json(
          { error: "Failed to create user" },
          { status: 500 }
        );
      }

      // Update game with player2
      await supabase
        .from("games")
        .update({
          player2_id: player2UserId,
          status: "playing",
        })
        .eq("id", waitingGame.id);

      // Get player1 address
      const { data: player1User } = await supabase
        .from("users")
        .select("wallet_address")
        .eq("id", waitingGame.player1_id)
        .single();

      // Notify both players
      await triggerMatchFound(player1User?.wallet_address || "", {
        gameId: waitingGame.id,
        opponent: playerId,
        stake,
      });

      await triggerMatchFound(playerId, {
        gameId: waitingGame.id,
        opponent: player1User?.wallet_address || "",
        stake,
      });

      // Trigger round start for first round
      await triggerRoundStart(waitingGame.id, {
        roundNumber: 1,
        score: {
          player1: 0,
          player2: 0,
        },
      });

      return NextResponse.json({
        matched: true,
        gameId: waitingGame.id,
        opponent: player1User?.wallet_address || "",
        stake: stake,
      });
    }

    // No match found, create new game and wait
    // First, get or create user
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("wallet_address", playerId)
      .single();
    
    let userId = user?.id;
    if (!userId) {
      // Use 0 as default for non-Farcaster users (database requires NOT NULL)
      // If UNIQUE constraint exists, this may need to be changed to a unique value per user
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          wallet_address: playerId,
          farcaster_fid: 0, // Default for non-Farcaster users (NOT NULL constraint)
          username: `Player_${playerId.slice(0, 6)}`,
        })
        .select()
        .single();
      
      if (createError) {
        console.error("Error creating user:", createError);
        // If UNIQUE constraint violation, try with a unique negative value
        if (createError.code === '23505') {
          // Generate a unique negative FID based on wallet address hash
          const hashFid = -(Math.abs(playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 1000000);
          const { data: retryUser, error: retryError } = await supabase
            .from("users")
            .insert({
              wallet_address: playerId,
              farcaster_fid: hashFid,
              username: `Player_${playerId.slice(0, 6)}`,
            })
            .select()
            .single();
          
          if (retryError) {
            return NextResponse.json(
              { error: `Failed to create user: ${retryError.message}` },
              { status: 500 }
            );
          }
          userId = retryUser?.id;
        } else {
          return NextResponse.json(
            { error: `Failed to create user: ${createError.message}` },
            { status: 500 }
          );
        }
      } else {
        userId = newUser?.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const { data: newGames, error: gameError } = await supabase
      .from("games")
      .insert({
        game_id: `game_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        player1_id: userId,
        stake: stake.toString(),
        status: "pending",
        current_round: 1,
        rounds: [],
      })
      .select();
    
    if (gameError) {
      console.error("Error creating game:", gameError);
      return NextResponse.json(
        { error: `Failed to create game: ${gameError.message}` },
        { status: 500 }
      );
    }
    
    const newGame = newGames && newGames.length > 0 ? newGames[0] : null;

    if (!newGame) {
      return NextResponse.json(
        { error: "Failed to create game" },
        { status: 500 }
      );
    }

    // Notify player they're in queue
    await triggerQueued(playerId, {
      stake,
      position: 1,
    });

    return NextResponse.json({
      matched: false,
      gameId: newGame.id,
      queued: true,
    });
  } catch (error) {
    console.error("Matchmaking error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

