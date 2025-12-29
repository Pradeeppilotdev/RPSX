"use client";

import { useEffect } from "react";
import { usePusher } from "./usePusher";
import { useGameStore } from "@/store/gameStore";
import { joinMatchmakingQueue, leaveMatchmakingQueue, sendMove } from "@/lib/pusher/client";
import { useAccount } from "wagmi";
import type { GameState, RoundResult } from "@/lib/types";

export function useGame() {
  const { pusher, connected, subscribeToGame, subscribeToMatchmaking } = usePusher();
  const { address } = useAccount();
  const {
    currentGame,
    isInQueue,
    selectedStake,
    currentMove,
    roundResult,
    setCurrentGame,
    setIsInQueue,
    setCurrentMove,
    setRoundResult,
    resetGame,
  } = useGameStore();

  useEffect(() => {
    if (!connected) return;

    // Subscribe to matchmaking
    const unsubscribeMatchmaking = subscribeToMatchmaking({
      onMatched: (data: { gameId: string; opponent: any; stake: number }) => {
        const game: GameState = {
          id: data.gameId,
          player1: address || "",
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
        };
        setCurrentGame(game);
        setIsInQueue(false);
      },
      onQueued: () => {
        setIsInQueue(true);
      },
    });

    // Subscribe to game events if we have a game
    if (currentGame?.id) {
      const unsubscribeGame = subscribeToGame(currentGame.id, {
        onRoundStart: (data: { roundNumber: number; score: any }) => {
          if (currentGame) {
            setCurrentGame({
              ...currentGame,
              currentRound: data.roundNumber,
              player1Score: data.score.player1,
              player2Score: data.score.player2,
              status: "playing",
            });
            setCurrentMove(null);
            setRoundResult(null);
          }
        },
        onRoundResult: (data: {
          roundNumber: number;
          player1Move: string;
          player2Move: string;
          winner: string;
          player1Score: number;
          player2Score: number;
          gameEnd?: boolean;
        }) => {
          const result: RoundResult = {
            player1Move: data.player1Move as any,
            player2Move: data.player2Move as any,
            winner: data.winner === "player1" ? "player1" : data.winner === "player2" ? "player2" : "draw",
            roundNumber: data.roundNumber,
          };
          setRoundResult(result);
          
          if (currentGame) {
            setCurrentGame({
              ...currentGame,
              player1Score: data.player1Score,
              player2Score: data.player2Score,
              rounds: [...currentGame.rounds, result],
              status: data.gameEnd ? "finished" : "playing",
            });
          }
        },
        onGameEnd: (data: {
          gameId: string;
          winner: string;
          loser: string;
          finalScore: any;
          rounds: any[];
        }) => {
          if (currentGame) {
            setCurrentGame({
              ...currentGame,
              status: "finished",
              winner: data.winner === currentGame.player1 ? "player1" : "player2",
              finishedAt: Date.now(),
            });
          }
        },
      });

      return () => {
        unsubscribeGame();
        unsubscribeMatchmaking();
      };
    }

    return () => {
      unsubscribeMatchmaking();
    };
  }, [connected, currentGame, subscribeToGame, subscribeToMatchmaking, setCurrentGame, setIsInQueue, setCurrentMove, setRoundResult, address]);

  const joinQueue = async (stake: number) => {
    if (!address) {
      console.error("Cannot join queue: No wallet address");
      alert("Please connect your wallet first");
      return;
    }
    
    // Don't require Pusher connection - API will work regardless
    // Pusher is only needed for real-time updates
    
    try {
      console.log("Joining matchmaking queue:", { stake, address });
      setIsInQueue(true); // Optimistically set to true for better UX
      
      const response = await joinMatchmakingQueue(stake, address);
      const data = await response.json();
      
      if (!response.ok) {
        console.error("Failed to join queue:", {
          status: response.status,
          statusText: response.statusText,
          data: data
        });
        setIsInQueue(false);
        const errorMsg = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`;
        alert(`Failed to join queue: ${errorMsg}`);
        return;
      }
      
      console.log("Queue join response:", data);
      
      // If matched immediately, update game state directly
      if (data.matched && data.gameId) {
        console.log("Matched immediately!", data);
        // Create game state immediately since we matched
        const game: GameState = {
          id: data.gameId,
          player1: address || "",
          player2: data.opponent || "Unknown",
          stake: stake,
          status: "lobby",
          rounds: [],
          player1Score: 0,
          player2Score: 0,
          currentRound: 0,
          createdAt: Date.now(),
          finishedAt: null,
          winner: null,
        };
        setCurrentGame(game);
        setIsInQueue(false);
        // Pusher event will also trigger, but we set it immediately for better UX
      } else {
        console.log("Waiting for opponent...");
        // Already set isInQueue to true above
      }
    } catch (error) {
      console.error("Error joining queue:", error);
      setIsInQueue(false);
      alert(`Error joining queue: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const leaveQueue = async () => {
    if (!address) return;
    await leaveMatchmakingQueue(address);
    setIsInQueue(false);
  };

  const makeMove = async (move: string) => {
    if (!currentGame || !address) return;
    await sendMove(currentGame.id, move, address);
    setCurrentMove(move as any);
  };

  return {
    currentGame,
    isInQueue,
    selectedStake,
    currentMove,
    roundResult,
    joinQueue,
    leaveQueue,
    makeMove,
    resetGame,
    connected,
  };
}

