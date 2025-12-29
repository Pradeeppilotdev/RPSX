"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import type { Move } from "@rps/shared";

interface MoveSelectorProps {
  onMove: (move: Move) => void;
  disabled?: boolean;
}

const moves: { move: Move; emoji: string; label: string }[] = [
  { move: "rock", emoji: "✊", label: "Rock" },
  { move: "paper", emoji: "✋", label: "Paper" },
  { move: "scissors", emoji: "✌️", label: "Scissors" },
];

export function MoveSelector({ onMove, disabled }: MoveSelectorProps) {
  return (
    <div className="space-y-6">
      <p className="text-center text-xl font-doodle font-bold">
        Choose your move:
      </p>
      <div className="flex justify-center gap-6">
        {moves.map(({ move, emoji, label }) => (
          <motion.div
            key={move}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant="doodle"
              onClick={() => onMove(move)}
              disabled={disabled}
              className="text-6xl px-8 py-12 border-4 border-black"
              aria-label={label}
            >
              {emoji}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

