import { NextRequest, NextResponse } from "next/server";
import { pusher } from "@/lib/pusher/server";

export async function POST(req: NextRequest) {
  try {
    const { socket_id, channel_name } = await req.json();

    // Validate required parameters
    if (!socket_id || !channel_name) {
      return NextResponse.json(
        { error: "Missing socket_id or channel_name" },
        { status: 400 }
      );
    }

    // Check if Pusher is configured (fail fast for all channel types)
    // This ensures configuration issues are caught early, regardless of channel type
    if (!pusher || typeof pusher.authorizeChannel !== 'function') {
      console.error("Pusher not configured - check PUSHER_APP_ID, PUSHER_SECRET in .env.local");
      return NextResponse.json(
        { error: "Pusher not configured" },
        { status: 500 }
      );
    }

    // Authenticate private/presence channels
    // For public channels, you can return success without auth
    if (channel_name.startsWith("private-") || channel_name.startsWith("presence-")) {
      try {
        const auth = pusher.authorizeChannel(socket_id, channel_name);
        return NextResponse.json(auth);
      } catch (authError) {
        console.error("Pusher auth error:", authError);
        return NextResponse.json(
          { error: "Authentication failed" },
          { status: 401 }
        );
      }
    }

    // Public channels don't need auth (but Pusher must be configured)
    return NextResponse.json({});
  } catch (error) {
    console.error("Pusher auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

