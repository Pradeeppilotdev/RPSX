import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { playerId } = await req.json();

    if (!playerId) {
      return NextResponse.json(
        { error: "Missing playerId" },
        { status: 400 }
      );
    }

    // Get user ID from wallet address
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("wallet_address", playerId)
      .single();

    if (user) {
      // Remove player from queue (delete pending games)
      await supabase
        .from("games")
        .delete()
        .eq("player1_id", user.id)
        .eq("status", "pending");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Leave queue error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

