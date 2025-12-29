"use client";

import { useState, useEffect } from "react";
import { useSignMessage } from "wagmi";
import { Socket } from "socket.io-client";
import { Button } from "./ui/button";
import type { GameState, Move, RoundResult } from "@rps/shared";
import { motion } from "framer-motion";
import { sha256, randomUUID } from "@/lib/crypto";

const moves: Move[] = ["rock", "paper", "scissors"];

export function GameBoard({
  socket,
  gameState: initialGameState,
  address,
  onGameEnd,
}: {
  socket: Socket;
  gameState: GameState;
  address: string;
  onGameEnd: () => void;
}) {
  const [gameState, setGameState] = useState(initialGameState);
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [committed, setCommitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    socket.on("game-state", (state) => {
      setGameState(state);
    });

    socket.on("move-committed", () => {
      setCommitted(true);
    });

    socket.on("request-reveal", () => {
      setCommitted(true);
    });

    socket.on("move-revealed", () => {
      setRevealed(true);
    });

    socket.on("round-result", (result) => {
      setRoundResult(result);
      setSelectedMove(null);
      setCommitted(false);
      setRevealed(false);
    });

    socket.on("game-finished", (result) => {
      setRoundResult({
        player1Move: null,
        player2Move: null,
        winner: result.winner === "player1" ? "player1" : "player2",
        roundNumber: gameState.currentRound,
      });
    });

    return () => {
      socket.off("game-state");
      socket.off("move-committed");
      socket.off("request-reveal");
      socket.off("move-revealed");
      socket.off("round-result");
      socket.off("game-finished");
    };
  }, [socket, gameState.currentRound]);

  const [moveNonce, setMoveNonce] = useState<string | null>(null);

  const handleMoveSelect = async (move: Move) => {
    if (committed) return;

    setSelectedMove(move);
    const nonce = randomUUID();
    setMoveNonce(nonce);
    const commitment = await sha256(`${move}:${nonce}:${gameState.id}`);

    try {
      const signature = await signMessageAsync({
        message: commitment,
      });

      socket.emit("commit-move", {
        gameId: gameState.id,
        commitment,
        signature,
      });
    } catch (error) {
      console.error("Failed to commit move:", error);
    }
  };

  const handleReveal = async () => {
    if (!selectedMove || !moveNonce || revealed) return;

    socket.emit("reveal-move", {
      gameId: gameState.id,
      move: selectedMove,
      nonce: moveNonce,
    });
  };

  const isPlayer1 = address === gameState.player1;
  const currentScore = isPlayer1
    ? gameState.player1Score
    : gameState.player2Score;
  const opponentScore = isPlayer1
    ? gameState.player2Score
    : gameState.player1Score;

  return (
    <div className="doodle-card max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-doodle font-bold mb-4">
          Round {gameState.currentRound + 1}/5
        </h2>
        <div className="flex justify-center gap-8 text-2xl">
          <div>
            <p className="text-sm text-gray-600">You</p>
            <p className="font-bold">{currentScore}</p>
          </div>
          <div className="text-4xl">-</div>
          <div>
            <p className="text-sm text-gray-600">Opponent</p>
            <p className="font-bold">{opponentScore}</p>
          </div>
        </div>
      </div>

      {roundResult && roundResult.winner && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center mb-6 p-4 bg-gray-100 rounded-lg"
        >
          <p className="text-2xl font-bold">
            {roundResult.winner === (isPlayer1 ? "player1" : "player2")
              ? "You Win!"
              : roundResult.winner === "draw"
              ? "Draw!"
              : "You Lose!"}
          </p>
        </motion.div>
      )}

      {!committed && !revealed && (
        <div className="space-y-4">
          <p className="text-center text-lg mb-4">Choose your move:</p>
          <div className="flex justify-center gap-4">
            {moves.map((move) => (
              <Button
                key={move}
                variant="doodle"
                onClick={() => handleMoveSelect(move)}
                className="text-4xl px-8 py-6"
              >
                {move === "rock" ? "✊" : move === "paper" ? "✋" : "✌️"}
              </Button>
            ))}
          </div>
        </div>
      )}

      {committed && !revealed && (
        <div className="text-center">
          <p className="text-xl mb-4">Waiting for opponent...</p>
          <Button variant="doodle" onClick={handleReveal}>
            Reveal Move
          </Button>
        </div>
      )}

      {revealed && (
        <div className="text-center">
          <p className="text-xl">Waiting for opponent to reveal...</p>
        </div>
      )}
    </div>
  );
}

