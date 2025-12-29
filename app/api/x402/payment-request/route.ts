import { NextRequest, NextResponse } from "next/server";
import { parseEther } from "viem";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

/**
 * x402 Payment Protocol Integration
 * Handles seamless payment requests for deposits
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, amount, currency = "ETH" } = body;

    if (!address || !amount) {
      return NextResponse.json({ error: "Missing address or amount" }, { status: 400 });
    }

    // Validate amount
    const amountWei = parseEther(amount.toString());
    const minDeposit = parseEther("0.001"); // Minimum deposit from contract

    if (amountWei < minDeposit) {
      return NextResponse.json(
        { error: `Amount must be at least ${minDeposit} ETH` },
        { status: 400 }
      );
    }

    // Create payment request
    const paymentRequest = {
      address,
      amount: amount.toString(),
      amountWei: amountWei.toString(),
      currency,
      timestamp: Date.now(),
      status: "pending",
    };

    // Return x402 payment response
    const response = {
      paymentRequest: {
        address,
        amount: amount.toString(),
        currency,
        recipient: CONTRACT_ADDRESS,
        chainId: 8453, // Base mainnet
        tokenAddress: null, // ETH
        memo: `RPS Pool Deposit - ${address.slice(0, 6)}...${address.slice(-4)}`,
      },
      // x402 protocol response
      paymentUrl: `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/x402/pay?request=${encodeURIComponent(JSON.stringify(paymentRequest))}`,
      callbackUrl: `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/x402/payment-callback`,
    };

    // Return with 402 status code (Payment Required) - x402 protocol standard
    return NextResponse.json(response, { status: 402 });
  } catch (error) {
    console.error("x402 payment request error:", error);
    return NextResponse.json({ error: "Payment request failed" }, { status: 500 });
  }
}

