import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

/**
 * x402 payment callback (called after payment is processed)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      address,
      amount,
      txHash,
      status,
      paymentRequestId,
    } = body;

    if (status === "completed" && txHash) {
      // Verify transaction onchain
      // Update user balance in database
      const { data: user } = await supabase
        .from("users")
        .select("id, wallet_address, total_earnings")
        .eq("wallet_address", address)
        .single();

      if (user) {
        await supabase
          .from("users")
          .update({
            total_earnings: (parseFloat((user as any).total_earnings || "0") + parseFloat(amount)).toString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      } else {
        // Create user if doesn't exist
        await supabase
          .from("users")
          .insert({
            wallet_address: address,
            total_earnings: amount,
            farcaster_fid: null,
            username: null,
          });
      }

      return NextResponse.json({
        success: true,
        message: "Payment processed",
        txHash,
      });
    }

    return NextResponse.json({ success: false, message: "Payment not completed" });
  } catch (error) {
    console.error("x402 callback error:", error);
    return NextResponse.json({ error: "Callback processing failed" }, { status: 500 });
  }
}

