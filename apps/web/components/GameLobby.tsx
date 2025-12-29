"use client";

import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { GameBoard } from "./GameBoard";
import { Button } from "./ui/button";
import type { GameState } from "@rps/shared";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

export function GameLobby({ address }: { address: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  const [selectedStake, setSelectedStake] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on("matched", (data) => {
      setGameState({
        id: data.gameId,
        player1: address,
        player2: data.opponent,
        stake: data.stake,
        status: "lobby",
        rounds: [],
        player1Score: 0,
        player2Score: 0,
        currentRound: 0,
        createdAt: Date.now(),
        finishedAt: null,
        winner: null,
      });
      setIsInQueue(false);
    });

    newSocket.on("game-state", (state) => {
      setGameState(state);
    });

    return () => {
      newSocket.close();
    };
  }, [address]);

  const joinQueue = (stake: number) => {
    if (!socket) return;
    setSelectedStake(stake);
    setIsInQueue(true);
    socket.emit("join-queue", { address, stake });
  };

  const leaveQueue = () => {
    if (!socket) return;
    socket.emit("leave-queue");
    setIsInQueue(false);
    setSelectedStake(null);
  };

  if (gameState) {
    return (
      <GameBoard
        socket={socket!}
        gameState={gameState}
        address={address}
        onGameEnd={() => setGameState(null)}
      />
    );
  }

  return (
    <div className="doodle-card max-w-md mx-auto">
      <h2 className="text-3xl font-doodle font-bold mb-6 text-center">
        Choose Your Stake
      </h2>
      <div className="space-y-4">
        {[0.5, 1, 2].map((stake) => (
          <Button
            key={stake}
            variant="doodle"
            onClick={() => joinQueue(stake)}
            disabled={isInQueue}
            className="w-full text-xl py-6"
          >
            ${stake} Game
          </Button>
        ))}
        {isInQueue && (
          <div className="text-center mt-4">
            <p className="text-lg mb-4">Finding opponent...</p>
            <Button variant="outline" onClick={leaveQueue}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

