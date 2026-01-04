"use client";

import { useEffect, useRef } from "react";
import { usePusher } from "./usePusher";
import { useGameStore } from "@/store/gameStore";
import { joinMatchmakingQueue, leaveMatchmakingQueue, sendMove } from "@/lib/pusher/client";
import { useAccount } from "wagmi";
import type { GameState, RoundResult } from "@/lib/types";

export function useGame() {
  const { pusher, connected, subscribeToGame, subscribeToMatchmaking } = usePusher();
  const { address } = useAccount();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
  
  // Ref to always access the latest currentGame in event handlers
  // This prevents stale closures when the effect doesn't re-run
  const currentGameRef = useRef<GameState | null>(currentGame);
  
  // Keep ref in sync with currentGame
  useEffect(() => {
    currentGameRef.current = currentGame;
  }, [currentGame]);

  // Polling function to fetch game state when Pusher isn't working
  const pollGameState = async (gameId: string) => {
    try {
      const response = await fetch(`/api/games/${gameId}`);
      if (!response.ok) {
        console.warn("Failed to poll game state:", response.status);
        return;
      }
      
      const gameData = await response.json();
      
      // Update game state from API
      const updatedGame: GameState = {
        id: gameData.id,
        player1: gameData.player1,
        player2: gameData.player2,
        stake: gameData.stake,
        status: gameData.status || "lobby",
        rounds: gameData.rounds || [],
        player1Score: gameData.player1Score || 0,
        player2Score: gameData.player2Score || 0,
        currentRound: gameData.currentRound || 0,
        createdAt: new Date(gameData.createdAt).getTime(),
        finishedAt: gameData.finishedAt ? new Date(gameData.finishedAt).getTime() : null,
        winner: gameData.winner,
      };
      
      // Check if round result changed - look at the last completed round
      const lastRound = updatedGame.rounds[updatedGame.rounds.length - 1];
      if (lastRound && lastRound.winner) {
        // Check if this is a new round result
        const isNewResult = !roundResult || 
          roundResult.roundNumber !== lastRound.roundNumber ||
          roundResult.winner !== lastRound.winner;
        
        if (isNewResult) {
          const result: RoundResult = {
            player1Move: lastRound.player1Move,
            player2Move: lastRound.player2Move,
            winner: lastRound.winner,
            roundNumber: lastRound.roundNumber || updatedGame.rounds.length,
          };
          setRoundResult(result);
          setCurrentMove(null);
          
          // Clear round result after 3 seconds
          setTimeout(() => {
            setRoundResult(null);
          }, 3000);
        }
      } else if (lastRound && !lastRound.winner && roundResult) {
        // Round is in progress but no result yet - clear any stale result
        if (roundResult.roundNumber === lastRound.roundNumber) {
          setRoundResult(null);
        }
      }
      
      setCurrentGame(updatedGame);
    } catch (error) {
      console.error("Error polling game state:", error);
    }
  };

  // Separate effect for matchmaking subscription - unsubscribe when game is active
  useEffect(() => {
    if (!connected || !address) {
      return;
    }

    // Don't subscribe to matchmaking if already in a game
    // This prevents matchmaking events from overwriting active game state
    if (currentGame?.id) {
      return;
    }

    // Subscribe to matchmaking only when not in a game
    const unsubscribeMatchmaking = subscribeToMatchmaking({
      onMatched: (data: { gameId: string; opponent: any; stake: number }) => {
        const game: GameState = {
          id: data.gameId,
          player1: address || "",
          player2: data.opponent,
          stake: data.stake,
          status: "playing", // Consistent with API response
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

    return () => {
      unsubscribeMatchmaking();
    };
  }, [connected, address, currentGame?.id, subscribeToMatchmaking, setCurrentGame, setIsInQueue]);

  // Separate effect for game subscription and polling - depends on game state
  useEffect(() => {
    if (connected) {
      // Subscribe to game events if we have a game
      if (currentGame?.id) {
        const unsubscribeGame = subscribeToGame(currentGame.id, {
          onRoundStart: (data: { roundNumber: number; score: any }) => {
            // Use ref to get latest game state (avoids stale closure)
            const latestGame = currentGameRef.current;
            if (latestGame) {
              setCurrentGame({
                ...latestGame,
                // Convert 1-indexed roundNumber from backend to 0-indexed for frontend
                currentRound: data.roundNumber - 1,
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
            
            // Use ref to get latest game state (avoids stale closure)
            const latestGame = currentGameRef.current;
            if (latestGame) {
              setCurrentGame({
                ...latestGame,
                player1Score: data.player1Score,
                player2Score: data.player2Score,
                rounds: [...latestGame.rounds, result],
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
            // Use ref to get latest game state (avoids stale closure)
            const latestGame = currentGameRef.current;
            if (latestGame) {
              setCurrentGame({
                ...latestGame,
                status: "finished",
                winner: data.winner === latestGame.player1 ? "player1" : "player2",
                finishedAt: Date.now(),
              });
            }
          },
        });

        return () => {
          unsubscribeGame();
          // Clean up polling interval if it exists
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        };
      } else {
        // Clean up polling interval when no game
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } else {
      // If Pusher not connected, set up polling fallback for active games
      if (currentGame?.id) {
        // Poll every 2 seconds when Pusher isn't working
        // Use a flag to prevent overlapping polls
        let isPolling = false;
        pollingIntervalRef.current = setInterval(() => {
          // Prevent overlapping polls
          if (isPolling) {
            console.warn("Skipping poll - previous poll still in progress");
            return;
          }
          
          isPolling = true;
          pollGameState(currentGame.id)
            .catch((error) => {
              console.error("Error in polling fallback:", error);
            })
            .finally(() => {
              isPolling = false;
            });
        }, 2000);
        
        return () => {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        };
      }
    }
  }, [connected, currentGame?.id, subscribeToGame, setCurrentGame, setCurrentMove, setRoundResult, roundResult]);

  const joinQueue = async (stake: number) => {
    if (!address) {
      console.error("Cannot join queue: No wallet address");
      alert("Please connect your wallet first");
      return;
    }
    
    try {
      setIsInQueue(true); // Optimistically set for better UX
      const response = await joinMatchmakingQueue(stake, address);
      const data = await response.json();
      
      if (!response.ok) {
        console.error("Failed to join queue:", data);
        setIsInQueue(false);
        alert(`Failed to join queue: ${data.error || "Unknown error"}`);
        return;
      }
      
      // If matched immediately, update game state and clear queue status
      // This ensures UI updates even if Pusher events are delayed or unavailable
      if (data.matched && data.gameId) {
        const game: GameState = {
          id: data.gameId,
          player1: address || "",
          player2: data.opponent || "Unknown",
          stake: stake,
          status: "playing",
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
      }
      // If not matched, isInQueue remains true (waiting for opponent)
    } catch (error) {
      console.error("Error joining queue:", error);
      setIsInQueue(false);
      alert(`Error joining queue: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const leaveQueue = async () => {
    if (!address) return;
    
    try {
      const response = await leaveMatchmakingQueue(address);
      if (!response.ok) {
        const data = await response.json();
        console.error("Failed to leave queue:", data);
        alert(`Failed to leave queue: ${data.error || "Unknown error"}`);
        return;
      }
      setIsInQueue(false);
    } catch (error) {
      console.error("Error leaving queue:", error);
      alert(`Error leaving queue: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const makeMove = async (move: string) => {
    if (!currentGame || !address) {
      console.error("Cannot make move: missing game or address");
      return;
    }
    
    try {
      setCurrentMove(move as any); // Optimistically set for better UX
      const response = await sendMove(currentGame.id, move, address);
      const data = await response.json();
      
      if (!response.ok) {
        console.error("Move submission failed:", data);
        setCurrentMove(null); // Clear move on error
        alert(`Failed to submit move: ${data.error || "Unknown error"}`);
        return;
      }
      
      // Move submitted successfully, Pusher events will handle state updates
    } catch (error) {
      console.error("Error making move:", error);
      setCurrentMove(null); // Clear move on error
      alert(`Error submitting move: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
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

