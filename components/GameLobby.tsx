"use client";

import { useGame } from "@/hooks/useGame";
import { useAccount } from "wagmi";
import { GameBoard } from "./game/GameBoard";
import { Button } from "./ui/button";

export function GameLobby({ address }: { address: string }) {
  const { isInQueue, joinQueue, leaveQueue, currentGame } = useGame();

  if (currentGame) {
    return <GameBoard />;
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

