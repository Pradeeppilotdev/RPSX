import { Hono } from "hono";
import { db } from "../db/client";
import { users, games, transactions } from "../db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { z } from "zod";
import { setupX402Routes } from "./x402";

export function setupRoutes(app: Hono) {
  // x402 payment routes
  setupX402Routes(app);
  // Get user balance
  app.get("/api/user/:address/balance", async (c) => {
    const address = c.req.param("address");
    
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, address),
      columns: { totalEarnings: true },
    });

    return c.json({ balance: user?.totalEarnings || "0" });
  });

  // Get user stats
  app.get("/api/user/:address/stats", async (c) => {
    const address = c.req.param("address");
    
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, address),
      columns: {
        totalWins: true,
        totalLosses: true,
        totalEarnings: true,
        currentStreak: true,
      },
    });

    return c.json(user || {
      totalWins: 0,
      totalLosses: 0,
      totalEarnings: "0",
      currentStreak: 0,
    });
  });

  // Get game history
  app.get("/api/user/:address/games", async (c) => {
    const address = c.req.param("address");
    const limit = Number(c.req.query("limit")) || 20;
    
    // First get user ID
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, address),
    });

    if (!user) {
      return c.json([]);
    }

    const userGames = await db.query.games.findMany({
      where: or(
        eq(games.player1Id, user.id),
        eq(games.player2Id, user.id)
      ),
      orderBy: desc(games.createdAt),
      limit,
    });

    return c.json(userGames);
  });

  // Get leaderboard
  app.get("/api/leaderboard", async (c) => {
    const leaderboard = await db.query.users.findMany({
      where: and(eq(users.totalWins, 0)), // Only users with wins
      orderBy: [desc(users.totalWins), desc(users.totalEarnings)],
      limit: 100,
      columns: {
        id: true,
        farcasterFid: true,
        username: true,
        walletAddress: true,
        totalWins: true,
        totalEarnings: true,
        currentStreak: true,
      },
    });

    // Add rank
    const withRank = leaderboard.map((user, index) => ({
      ...user,
      rank: index + 1,
    }));

    return c.json(withRank);
  });

  // Get pending settlements
  app.get("/api/settlements/pending", async (c) => {
    const pendingGames = await db.query.games.findMany({
      where: and(
        eq(games.status, "completed"),
        // Note: Need to add settled field to schema or use status check
      ),
      orderBy: desc(games.completedAt),
      limit: 50,
      columns: {
        id: true,
        gameId: true,
        player1Id: true,
        player2Id: true,
        stake: true,
        winnerId: true,
        player1Signature: true,
        player2Signature: true,
      },
    });

    return c.json(pendingGames);
  });

  // Mark game as settled
  app.post("/api/games/:gameId/settled", async (c) => {
    const gameId = c.req.param("gameId");
    const body = await c.req.json();
    const { txHash } = z.object({ txHash: z.string() }).parse(body);

    await db
      .update(games)
      .set({
        status: "settled",
        settlementTxHash: txHash,
        settledAt: new Date(),
      })
      .where(eq(games.id, gameId));

    return c.json({ success: true });
  });
}

