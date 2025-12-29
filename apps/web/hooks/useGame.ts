import { useEffect } from "react";
import { useSocket } from "./useSocket";
import { useGameStore } from "@/store/gameStore";
import type { GameState, RoundResult } from "@rps/shared";

export function useGame() {
  const { socket, connected } = useSocket();
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
    if (!socket || !connected) return;

    // Match found
    socket.on("match:found", (data: { gameId: string; opponent: any; stake: number }) => {
      const game: GameState = {
        id: data.gameId,
        player1: "", // Will be set from wallet
        player2: data.opponent.address || "",
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
    });

    // Round start
    socket.on("round:start", (data: { roundNumber: number; score: any }) => {
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
    });

    // Round result
    socket.on("round:result", (data: {
      roundNumber: number;
      player1Move: string;
      player2Move: string;
      winner: string;
      score: any;
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
          player1Score: data.score.player1,
          player2Score: data.score.player2,
          rounds: [...currentGame.rounds, result],
        });
      }
    });

    // Game end
    socket.on("game:end", (data: {
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
    });

    return () => {
      socket.off("match:found");
      socket.off("round:start");
      socket.off("round:result");
      socket.off("game:end");
    };
  }, [socket, connected, currentGame, setCurrentGame, setIsInQueue, setCurrentMove, setRoundResult]);

  const joinQueue = (stake: number) => {
    if (!socket || !connected) return;
    socket.emit("matchmaking:join", { stake: stake.toString() });
    setIsInQueue(true);
  };

  const leaveQueue = () => {
    if (!socket) return;
    socket.emit("matchmaking:leave");
    setIsInQueue(false);
  };

  const makeMove = (move: string) => {
    if (!socket || !currentGame) return;
    socket.emit("game:move", { gameId: currentGame.id, move });
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

