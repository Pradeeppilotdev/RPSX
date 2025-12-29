"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface GameTimerProps {
  duration: number; // in seconds
  onTimeout?: () => void;
}

export function GameTimer({ duration, onTimeout }: GameTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeout?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeout]);

  const percentage = (timeLeft / duration) * 100;
  const isWarning = timeLeft <= 10;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-bold ${isWarning ? "text-red-600" : "text-gray-600"}`}>
          {timeLeft}s
        </span>
        <div className="w-24 h-2 bg-gray-200 border-2 border-black rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${isWarning ? "bg-red-600" : "bg-black"}`}
            initial={{ width: "100%" }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>
      </div>
    </div>
  );
}

