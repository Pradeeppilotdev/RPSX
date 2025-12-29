import { pgTable, uuid, varchar, integer, decimal, timestamp, boolean, jsonb, text, bigint, pgEnum, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const gameStatusEnum = pgEnum("game_status", ["pending", "playing", "completed", "settled"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["deposit", "withdraw", "settlement"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "confirmed", "failed"]);
export const lobbyStatusEnum = pgEnum("lobby_status", ["waiting", "started", "expired"]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  farcasterFid: integer("farcaster_fid").unique().notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  walletAddress: varchar("wallet_address", { length: 42 }).unique().notNull(),
  totalWins: integer("total_wins").default(0).notNull(),
  totalLosses: integer("total_losses").default(0).notNull(),
  totalEarnings: decimal("total_earnings", { precision: 20, scale: 8 }).default("0").notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  bestStreak: integer("best_streak").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  farcasterIdx: index("idx_users_farcaster").on(table.farcasterFid),
  walletIdx: index("idx_users_wallet").on(table.walletAddress),
}));

// Games table
export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: varchar("game_id", { length: 66 }).unique().notNull(), // bytes32 as hex
  player1Id: uuid("player1_id").references(() => users.id).notNull(),
  player2Id: uuid("player2_id").references(() => users.id),
  winnerId: uuid("winner_id").references(() => users.id),
  loserId: uuid("loser_id").references(() => users.id),
  stake: decimal("stake", { precision: 20, scale: 8 }).notNull(),
  status: gameStatusEnum("status").notNull(),
  rounds: jsonb("rounds").notNull(), // Array of round results
  player1Signature: text("player1_signature"),
  player2Signature: text("player2_signature"),
  settlementTxHash: varchar("settlement_tx_hash", { length: 66 }),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("idx_games_status").on(table.status),
  player1Idx: index("idx_games_player1").on(table.player1Id),
  player2Idx: index("idx_games_player2").on(table.player2Id),
  createdIdx: index("idx_games_created").on(table.createdAt),
}));

// Rounds table
export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").references(() => games.id).notNull(),
  roundNumber: integer("round_number").notNull(),
  player1Move: varchar("player1_move", { length: 10 }).notNull(), // 'rock', 'paper', 'scissors'
  player2Move: varchar("player2_move", { length: 10 }).notNull(),
  winnerId: uuid("winner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  gameRoundUnique: unique("unique_game_round").on(table.gameId, table.roundNumber),
}));

// Lobbies table
export const lobbies = pgTable("lobbies", {
  id: uuid("id").primaryKey().defaultRandom(),
  lobbyCode: varchar("lobby_code", { length: 8 }).unique().notNull(),
  creatorId: uuid("creator_id").references(() => users.id).notNull(),
  stake: decimal("stake", { precision: 20, scale: 8 }).notNull(),
  status: lobbyStatusEnum("status").notNull(),
  gameId: uuid("game_id").references(() => games.id),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: index("idx_lobbies_code").on(table.lobbyCode),
  statusIdx: index("idx_lobbies_status").on(table.status),
}));

// Transactions table
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  txHash: varchar("tx_hash", { length: 66 }).unique().notNull(),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  status: transactionStatusEnum("status").notNull(),
  blockNumber: bigint("block_number", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  gamesAsPlayer1: many(games),
  gamesAsPlayer2: many(games),
  transactions: many(transactions),
  lobbies: many(lobbies),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  player1: one(users, {
    fields: [games.player1Id],
    references: [users.id],
  }),
  player2: one(users, {
    fields: [games.player2Id],
    references: [users.id],
  }),
  winner: one(users, {
    fields: [games.winnerId],
    references: [users.id],
  }),
  rounds: many(rounds),
}));

export const roundsRelations = relations(rounds, ({ one }) => ({
  game: one(games, {
    fields: [rounds.gameId],
    references: [games.id],
  }),
  winner: one(users, {
    fields: [rounds.winnerId],
    references: [users.id],
  }),
}));

export const lobbiesRelations = relations(lobbies, ({ one }) => ({
  creator: one(users, {
    fields: [lobbies.creatorId],
    references: [users.id],
  }),
  game: one(games, {
    fields: [lobbies.gameId],
    references: [games.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

