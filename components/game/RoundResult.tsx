"use client";

import { motion } from "framer-motion";
import type { RoundResult } from "@/lib/types";

interface RoundResultProps {
  result: RoundResult;
  isPlayer1: boolean;
}

const moveEmojis = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

export function RoundResultDisplay({ result, isPlayer1 }: RoundResultProps) {
  const playerMove = isPlayer1 ? result.player1Move : result.player2Move;
  const opponentMove = isPlayer1 ? result.player2Move : result.player1Move;
  
  const isWinner = 
    (isPlayer1 && result.winner === "player1") ||
    (!isPlayer1 && result.winner === "player2");
  const isDraw = result.winner === "draw";

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="text-center space-y-6"
    >
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <div className="text-6xl mb-2">
            {playerMove ? moveEmojis[playerMove] : "?"}
          </div>
          <p className="text-sm font-bold">You</p>
        </div>
        
        <div className="text-4xl">VS</div>
        
        <div className="text-center">
          <div className="text-6xl mb-2">
            {opponentMove ? moveEmojis[opponentMove] : "?"}
          </div>
          <p className="text-sm font-bold">Opponent</p>
        </div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className={`text-3xl font-doodle font-bold ${
          isWinner ? "text-green-600" : isDraw ? "text-gray-600" : "text-red-600"
        }`}
      >
        {isWinner ? "🎉 You Win!" : isDraw ? "🤝 Draw!" : "😢 You Lose!"}
      </motion.div>
    </motion.div>
  );
}

