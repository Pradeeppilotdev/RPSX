import { create } from "zustand";
import type { GameState, Move, RoundResult } from "@rps/shared";

interface GameStore {
  // Game state
  currentGame: GameState | null;
  isInQueue: boolean;
  selectedStake: number;
  currentMove: Move | null;
  roundResult: RoundResult | null;
  
  // Actions
  setCurrentGame: (game: GameState | null) => void;
  setIsInQueue: (inQueue: boolean) => void;
  setSelectedStake: (stake: number) => void;
  setCurrentMove: (move: Move | null) => void;
  setRoundResult: (result: RoundResult | null) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Initial state
  currentGame: null,
  isInQueue: false,
  selectedStake: 1.0,
  currentMove: null,
  roundResult: null,

  // Actions
  setCurrentGame: (game) => set({ currentGame: game }),
  setIsInQueue: (inQueue) => set({ isInQueue: inQueue }),
  setSelectedStake: (stake) => set({ selectedStake: stake }),
  setCurrentMove: (move) => set({ currentMove: move }),
  setRoundResult: (result) => set({ roundResult: result }),
  resetGame: () => set({
    currentGame: null,
    isInQueue: false,
    currentMove: null,
    roundResult: null,
  }),
}));

