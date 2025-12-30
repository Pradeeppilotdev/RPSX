"use client";

import { useEffect } from "react";
import { useGame } from "@/hooks/useGame";
import { useAccount } from "wagmi";
import { MoveSelector } from "./MoveSelector";
import { RoundResultDisplay } from "./RoundResult";
import { GameTimer } from "./GameTimer";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

export function GameBoard() {
  const { currentGame, currentMove, roundResult, makeMove } = useGame();
  const { address } = useAccount();

  if (!currentGame) {
    return (
      <div className="text-center">
        <p>No active game</p>
      </div>
    );
  }

  const isPlayer1 = address === currentGame.player1;
  const currentScore = isPlayer1 ? currentGame.player1Score : currentGame.player2Score;
  const opponentScore = isPlayer1 ? currentGame.player2Score : currentGame.player1Score;

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-2xl mx-auto border-4 border-black">
        {/* Header with scores */}
        <div className="border-b-4 border-black p-4 bg-white">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs text-gray-600">YOU</div>
              <div className="text-2xl font-black">{currentScore}</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">
                Round {currentGame.currentRound + 1}/5
              </div>
              <GameTimer duration={60} />
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-600">OPPONENT</div>
              <div className="text-2xl font-black">{opponentScore}</div>
            </div>
          </div>
        </div>

        {/* Game area */}
        <div className="p-8">
          <AnimatePresence mode="wait">
            {roundResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <RoundResultDisplay result={roundResult} isPlayer1={isPlayer1} />
              </motion.div>
            ) : currentMove ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="text-6xl mb-4">
                  {currentMove === "rock" && "✊"}
                  {currentMove === "paper" && "✋"}
                  {currentMove === "scissors" && "✌️"}
                </div>
                <p className="text-lg font-bold">Waiting for opponent...</p>
              </motion.div>
            ) : (
              <motion.div
                key="selector"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <MoveSelector onMove={makeMove} disabled={!!currentMove || !!roundResult} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}

