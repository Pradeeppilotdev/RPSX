import { Server, Socket } from "socket.io";
import type { GameState, Move, RoundResult } from "@rps/shared";
import { GameManager } from "./gameManager";
import { MatchmakingQueue } from "./matchmaking";

const gameManager = new GameManager();
const matchmakingQueue = new MatchmakingQueue();

export function setupSocketIO(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join matchmaking queue
    socket.on("join-queue", async (data: { address: string; stake: number }) => {
      try {
        const { address, stake } = data;
        socket.data.address = address;
        socket.data.stake = stake;

        const match = await matchmakingQueue.addPlayer(socket.id, address, stake);
        
        if (match) {
          // Create game room
          const game = await gameManager.createGame(
            match.player1.address,
            match.player2.address,
            match.stake
          );

          // Join both players to game room
          match.player1.socket.join(game.id);
          match.player2.socket.join(game.id);

          // Notify both players
          io.to(match.player1.socket.id).emit("matched", {
            gameId: game.id,
            opponent: match.player2.address,
            stake: match.stake,
          });

          io.to(match.player2.socket.id).emit("matched", {
            gameId: game.id,
            opponent: match.player1.address,
            stake: match.stake,
          });
        } else {
          socket.emit("queue-joined", { stake });
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to join queue" });
      }
    });

    // Leave queue
    socket.on("leave-queue", () => {
      matchmakingQueue.removePlayer(socket.id);
      socket.emit("queue-left");
    });

    // Join game room
    socket.on("join-game", (data: { gameId: string; address: string }) => {
      const { gameId, address } = data;
      socket.join(gameId);
      socket.data.gameId = gameId;
      socket.data.address = address;

      const game = gameManager.getGame(gameId);
      if (game) {
        socket.emit("game-state", game);
      }
    });

    // Commit move
    socket.on("commit-move", async (data: { gameId: string; commitment: string; signature: string }) => {
      try {
        const { gameId, commitment, signature } = data;
        const address = socket.data.address;

        const result = await gameManager.commitMove(gameId, address, commitment, signature);
        
        if (result) {
          io.to(gameId).emit("move-committed", {
            player: address,
            round: result.currentRound,
          });

          // If both committed, request reveals
          if (result.status === "round_reveal") {
            io.to(gameId).emit("request-reveal", {
              round: result.currentRound,
            });
          }
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to commit move" });
      }
    });

    // Reveal move
    socket.on("reveal-move", async (data: { gameId: string; move: Move; nonce: string }) => {
      try {
        const { gameId, move, nonce } = data;
        const address = socket.data.address;

        const result = await gameManager.revealMove(gameId, address, move, nonce);
        
        if (result) {
          io.to(gameId).emit("move-revealed", {
            player: address,
            move,
            round: result.currentRound,
          });

          // If both revealed, calculate result
          if (result.status === "round_result") {
            const roundResult = result.rounds[result.currentRound - 1];
            io.to(gameId).emit("round-result", {
              round: result.currentRound,
              player1Move: roundResult.player1Move,
              player2Move: roundResult.player2Move,
              winner: roundResult.winner,
              player1Score: result.player1Score,
              player2Score: result.player2Score,
            });

            // Check if game finished
            if (result.status === "finished") {
              io.to(gameId).emit("game-finished", {
                winner: result.winner,
                player1Score: result.player1Score,
                player2Score: result.player2Score,
                rounds: result.rounds,
              });
            } else {
              // Start next round
              setTimeout(() => {
                io.to(gameId).emit("next-round", {
                  round: result.currentRound + 1,
                });
              }, 2000);
            }
          }
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to reveal move" });
      }
    });

    // Sign game result
    socket.on("sign-result", async (data: { gameId: string; signature: string }) => {
      try {
        const { gameId, signature } = data;
        const address = socket.data.address;

        const result = await gameManager.signResult(gameId, address, signature);
        
        if (result) {
          io.to(gameId).emit("result-signed", {
            player: address,
          });

          // If both signed, ready for settlement
          if (result.signature1 && result.signature2) {
            io.to(gameId).emit("ready-for-settlement", {
              gameId: result.id,
              winner: result.winner,
              loser: result.winner === result.player1 ? result.player2 : result.player1,
              stake: result.stake,
              signature1: result.signature1,
              signature2: result.signature2,
            });
          }
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to sign result" });
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      matchmakingQueue.removePlayer(socket.id);
      
      if (socket.data.gameId) {
        const game = gameManager.getGame(socket.data.gameId);
        if (game && game.status !== "finished") {
          // Handle disconnect - could forfeit game
          io.to(socket.data.gameId).emit("player-disconnected", {
            player: socket.data.address,
          });
        }
      }

      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

