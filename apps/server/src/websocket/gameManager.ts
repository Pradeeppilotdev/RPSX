import type { GameState, Move, RoundResult } from "@rps/shared";
import { createHash } from "node:crypto";
import { sql } from "../db/init";

export class GameManager {
  private games: Map<string, GameState> = new Map();

  async createGame(
    player1: string,
    player2: string,
    stake: number
  ): Promise<GameState> {
    const gameId = crypto.randomUUID();
    
    const game: GameState = {
      id: gameId,
      player1,
      player2,
      stake,
      status: "lobby",
      rounds: [],
      player1Score: 0,
      player2Score: 0,
      currentRound: 0,
      createdAt: Date.now(),
      finishedAt: null,
      winner: null,
    };

    this.games.set(gameId, game);

    // Save to database
    await sql`
      INSERT INTO games (id, player1_address, player2_address, stake, status)
      VALUES (${gameId}, ${player1}, ${player2}, ${stake}, ${game.status})
    `;

    return game;
  }

  getGame(gameId: string): GameState | null {
    return this.games.get(gameId) || null;
  }

  async commitMove(
    gameId: string,
    player: string,
    commitment: string,
    signature: string
  ): Promise<GameState | null> {
    const game = this.games.get(gameId);
    if (!game) return null;

    // Store commitment
    if (player === game.player1) {
      (game as any).player1Commitment = commitment;
      (game as any).player1CommitmentSig = signature;
    } else if (player === game.player2) {
      (game as any).player2Commitment = commitment;
      (game as any).player2CommitmentSig = signature;
    }

    // Check if both committed
    if ((game as any).player1Commitment && (game as any).player2Commitment) {
      game.status = "round_reveal";
    }

    this.games.set(gameId, game);
    return game;
  }

  async revealMove(
    gameId: string,
    player: string,
    move: Move,
    nonce: string
  ): Promise<GameState | null> {
    const game = this.games.get(gameId);
    if (!game) return null;

    // Verify commitment
    const commitment = createHash("sha256")
      .update(`${move}:${nonce}:${gameId}`)
      .digest("hex");

    if (player === game.player1) {
      if ((game as any).player1Commitment !== commitment) {
        throw new Error("Invalid commitment");
      }
      (game as any).player1Move = move;
      (game as any).player1Nonce = nonce;
    } else if (player === game.player2) {
      if ((game as any).player2Commitment !== commitment) {
        throw new Error("Invalid commitment");
      }
      (game as any).player2Move = move;
      (game as any).player2Nonce = nonce;
    }

    // Check if both revealed
    if ((game as any).player1Move && (game as any).player2Move) {
      game.status = "round_result";
      await this.calculateRoundResult(game);
    }

    this.games.set(gameId, game);
    return game;
  }

  private async calculateRoundResult(game: GameState): Promise<void> {
    const player1Move = (game as any).player1Move as Move;
    const player2Move = (game as any).player2Move as Move;

    const winner = this.determineWinner(player1Move, player2Move);

    const roundResult: RoundResult = {
      player1Move,
      player2Move,
      winner,
      roundNumber: game.currentRound,
    };

    game.rounds.push(roundResult);

    if (winner === "player1") {
      game.player1Score++;
    } else if (winner === "player2") {
      game.player2Score++;
    }

    // Check if game finished
    if (game.player1Score >= 3) {
      game.status = "finished";
      game.winner = "player1";
      game.finishedAt = Date.now();
    } else if (game.player2Score >= 3) {
      game.status = "finished";
      game.winner = "player2";
      game.finishedAt = Date.now();
    } else if (game.currentRound >= 5 && game.player1Score === game.player2Score) {
      // Tie - need tiebreaker
      game.currentRound++;
    } else if (game.currentRound < 5) {
      game.currentRound++;
      game.status = "playing";
      // Clear moves for next round
      (game as any).player1Move = null;
      (game as any).player2Move = null;
      (game as any).player1Commitment = null;
      (game as any).player2Commitment = null;
    }
  }

  private determineWinner(
    move1: Move,
    move2: Move
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

  async signResult(
    gameId: string,
    player: string,
    signature: string
  ): Promise<GameState | null> {
    const game = this.games.get(gameId);
    if (!game || game.status !== "finished") return null;

    if (player === game.player1) {
      (game as any).signature1 = signature;
    } else if (player === game.player2) {
      (game as any).signature2 = signature;
    }

    this.games.set(gameId, game);

    // Update database
    await sql`
      UPDATE games
      SET signature1 = ${(game as any).signature1 || null},
          signature2 = ${(game as any).signature2 || null}
      WHERE id = ${gameId}
    `;

    return game;
  }
}

