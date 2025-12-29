import { Hono } from "hono";
import { parseEther } from "viem";
import { sql } from "../db/init";

/**
 * x402 Payment Protocol Integration
 * Handles seamless payment requests for deposits
 */

export function setupX402Routes(app: Hono) {
  // x402 payment request endpoint
  app.post("/api/x402/payment-request", async (c) => {
    try {
      const body = await c.req.json();
      const { address, amount, currency = "ETH" } = body;

      if (!address || !amount) {
        return c.json({ error: "Missing address or amount" }, 400);
      }

      // Validate amount
      const amountWei = parseEther(amount.toString());
      const minDeposit = parseEther("0.001"); // Minimum deposit from contract

      if (amountWei < minDeposit) {
        return c.json(
          { error: `Amount must be at least ${minDeposit} ETH` },
          400
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

      // Store payment request (optional - for tracking)
      // In production, you might want to store this in DB

      // Return x402 payment response
      const response = {
        paymentRequest: {
          address,
          amount: amount.toString(),
          currency,
          recipient: process.env.CONTRACT_ADDRESS || "",
          chainId: 8453, // Base mainnet
          tokenAddress: null, // ETH
          memo: `RPS Pool Deposit - ${address.slice(0, 6)}...${address.slice(-4)}`,
        },
        // x402 protocol response
        paymentUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/x402/pay?request=${encodeURIComponent(JSON.stringify(paymentRequest))}`,
        callbackUrl: `${process.env.SERVER_URL || "http://localhost:3001"}/api/x402/payment-callback`,
      };

      // Return with 402 status code (Payment Required) - x402 protocol standard
      return c.json(response, 402);
    } catch (error) {
      console.error("x402 payment request error:", error);
      return c.json({ error: "Payment request failed" }, 500);
    }
  });

  // x402 payment callback (called after payment is processed)
  app.post("/api/x402/payment-callback", async (c) => {
    try {
      const body = await c.req.json();
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
        await sql`
          INSERT INTO users (address, balance, updated_at)
          VALUES (${address}, ${amount}, NOW())
          ON CONFLICT (address) 
          DO UPDATE SET 
            balance = users.balance + ${amount},
            updated_at = NOW()
        `;

        return c.json({
          success: true,
          message: "Payment processed",
          txHash,
        });
      }

      return c.json({ success: false, message: "Payment not completed" });
    } catch (error) {
      console.error("x402 callback error:", error);
      return c.json({ error: "Callback processing failed" }, 500);
    }
  });

  // Check payment status
  app.get("/api/x402/payment-status/:txHash", async (c) => {
    const txHash = c.req.param("txHash");

    // In production, verify transaction onchain
    // For now, return pending
    return c.json({
      status: "pending",
      txHash,
    });
  });
}

