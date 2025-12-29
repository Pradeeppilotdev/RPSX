export type Move = "rock" | "paper" | "scissors";

export type GameStatus = 
  | "waiting"
  | "matching"
  | "lobby"
  | "playing"
  | "round_commit"
  | "round_reveal"
  | "round_result"
  | "finished"
  | "settled";

export type RoundResult = {
  player1Move: Move | null;
  player2Move: Move | null;
  winner: "player1" | "player2" | "draw" | null;
  roundNumber: number;
};

export type GameState = {
  id: string;
  player1: string;
  player2: string | null;
  stake: number;
  status: GameStatus;
  rounds: RoundResult[];
  player1Score: number;
  player2Score: number;
  currentRound: number;
  createdAt: number;
  finishedAt: number | null;
  winner: "player1" | "player2" | null;
};

export type Player = {
  address: string;
  fid?: number;
  username?: string;
  balance: number;
  totalWins: number;
  totalLosses: number;
  totalEarnings: number;
  winStreak: number;
};

export type LeaderboardEntry = {
  address: string;
  fid?: number;
  username?: string;
  wins: number;
  earnings: number;
  streak: number;
  rank: number;
};

export type GameSettlement = {
  gameId: string;
  winner: string;
  loser: string;
  stake: number;
  signature1: string;
  signature2: string;
};

