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
  const quickPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
      // Note: API already converts backend status ("in_progress", "completed") to frontend status ("playing", "finished")
      const updatedGame: GameState = {
        id: gameData.id,
        player1: gameData.player1,
        player2: gameData.player2,
        stake: gameData.stake,
        status: gameData.status || "lobby", // Use status directly - API already converts it
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
        // Check if this is a new round result (different from current roundResult)
        const isNewResult = !roundResult || 
          roundResult.roundNumber !== lastRound.roundNumber ||
          roundResult.winner !== lastRound.winner;
        
        if (isNewResult) {
          const result: RoundResult = {
            player1Move: lastRound.player1Move,
            player2Move: lastRound.player2Move,
            winner: lastRound.winner,
            // Fallback: rounds.length equals the last completed round number (1-indexed)
            // currentRound is 0-indexed and equals rounds.length when a round is in progress
            roundNumber: lastRound.roundNumber || updatedGame.rounds.length,
          };
          console.log("New round result detected:", result);
          setRoundResult(result);
          setCurrentMove(null); // Clear move when round result is shown
          
          // Clear round result after 3 seconds to show next round
          setTimeout(() => {
            setRoundResult(null);
            // If game is still in progress, poll again to get next round state
            if (updatedGame.status === "playing") {
              pollGameState(gameId).catch((error) => {
                console.error("Error polling after round result clear:", error);
              });
            }
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

  useEffect(() => {
    // Set up Pusher subscriptions if connected
    if (connected) {
      // Subscribe to matchmaking
      const unsubscribeMatchmaking = subscribeToMatchmaking({
      onMatched: (data: { gameId: string; opponent: any; stake: number }) => {
        const game: GameState = {
          id: data.gameId,
          player1: address || "",
          player2: data.opponent,
          stake: data.stake,
          status: "playing", // Start playing immediately when matched (consistent with API response)
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
        // Clean up quick poll interval if it exists
        if (quickPollIntervalRef.current) {
          clearInterval(quickPollIntervalRef.current);
          quickPollIntervalRef.current = null;
        }
      };
    }

      return () => {
        unsubscribeMatchmaking();
        // Clean up quick poll interval if it exists
        if (quickPollIntervalRef.current) {
          clearInterval(quickPollIntervalRef.current);
          quickPollIntervalRef.current = null;
        }
      };
    } else {
      // If Pusher not connected, set up polling fallback
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
          // Clean up quick poll interval if it exists
          if (quickPollIntervalRef.current) {
            clearInterval(quickPollIntervalRef.current);
            quickPollIntervalRef.current = null;
          }
        };
      }
    }
  }, [connected, currentGame, subscribeToGame, subscribeToMatchmaking, setCurrentGame, setIsInQueue, setCurrentMove, setRoundResult, address, roundResult]);

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
          status: "playing", // Start playing immediately when matched
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
        
        // Immediately poll game state to get the latest status
        // Wrap in try-catch to handle errors silently (fire-and-forget for UX)
        setTimeout(() => {
          pollGameState(data.gameId).catch((error) => {
            console.error("Error polling game state after match:", error);
          });
        }, 500);
        
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
    if (!currentGame || !address) {
      console.error("Cannot make move: missing game or address");
      return;
    }
    
    try {
      console.log("Making move:", { gameId: currentGame.id, move, address });
      setCurrentMove(move as any); // Set immediately for better UX
      
      const response = await sendMove(currentGame.id, move, address);
      const data = await response.json();
      
      if (!response.ok) {
        console.error("Move submission failed:", data);
        alert(`Failed to submit move: ${data.error || "Unknown error"}`);
        setCurrentMove(null); // Clear move on error
        return;
      }
      
      console.log("Move submitted successfully:", data);
      
      // Immediately poll game state to get updates (especially if Pusher isn't working)
      if (currentGame.id) {
        await pollGameState(currentGame.id);
      }
      
      // Set up a short polling interval after move to catch round results quickly
      // Clear any existing intervals first
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (quickPollIntervalRef.current) {
        clearInterval(quickPollIntervalRef.current);
        quickPollIntervalRef.current = null;
      }
      
      // Poll more frequently after a move (every 500ms for 5 seconds)
      // Use a flag to prevent overlapping polls
      let pollCount = 0;
      let isPolling = false;
      quickPollIntervalRef.current = setInterval(() => {
        // Prevent overlapping polls
        if (isPolling) {
          console.warn("Skipping poll - previous poll still in progress");
          return;
        }
        
        pollCount++;
        if (currentGame?.id) {
          isPolling = true;
          pollGameState(currentGame.id)
            .catch((error) => {
              console.error("Error in quick poll:", error);
            })
            .finally(() => {
              isPolling = false;
            });
        }
        
        if (pollCount >= 10) { // 10 * 500ms = 5 seconds
          if (quickPollIntervalRef.current) {
            clearInterval(quickPollIntervalRef.current);
            quickPollIntervalRef.current = null;
          }
          // Resume normal polling if Pusher still not connected
          if (!connected && currentGame?.id) {
            let normalPolling = false;
            pollingIntervalRef.current = setInterval(() => {
              // Prevent overlapping normal polls too
              if (normalPolling) return;
              normalPolling = true;
              pollGameState(currentGame.id)
                .catch((error) => {
                  console.error("Error in normal poll:", error);
                })
                .finally(() => {
                  normalPolling = false;
                });
            }, 2000);
          }
        }
      }, 500);
      
    } catch (error) {
      console.error("Error making move:", error);
      alert(`Error submitting move: ${error instanceof Error ? error.message : "Unknown error"}`);
      setCurrentMove(null); // Clear move on error
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

