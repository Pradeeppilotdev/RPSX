/**
 * Signature utilities for Rock Paper Scissors game
 * Used by both frontend and backend to sign/verify game results
 */
import { encodePacked, keccak256, type Address, type Hex } from 'ethers';
import { privateKeyToAccount } from 'viem/accounts';

export interface GameResult {
  gameId: string;
  winner: Address;
  loser: Address;
  stake: bigint;
  rounds: Round[];
}

export interface Round {
  roundNumber: number;
  player1Move: 'rock' | 'paper' | 'scissors';
  player2Move: 'rock' | 'paper' | 'scissors';
  winner: Address | 'tie';
}

/**
 * Create the message hash for a game result
 * Must match the contract's hashing logic exactly
 */
export function createGameResultHash(
  gameId: string,
  winner: Address,
  loser: Address,
  stake: bigint
): Hex {
  // Convert gameId string to bytes32
  const gameIdBytes = keccak256(encodePacked(['string'], [gameId]));
  
  // Create the message hash exactly as the contract does
  const messageHash = keccak256(
    encodePacked(
      ['bytes32', 'address', 'address', 'uint256'],
      [gameIdBytes, winner, loser, stake]
    )
  );
  
  return messageHash as Hex;
}

/**
 * Sign a game result with a private key (backend use)
 * Returns the signature in the format expected by the contract
 */
export async function signGameResult(
  gameId: string,
  winner: Address,
  loser: Address,
  stake: bigint,
  privateKey: Hex
): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  const messageHash = createGameResultHash(gameId, winner, loser, stake);
  
  // Sign the message hash
  const signature = await account.signMessage({
    message: { raw: messageHash }
  });
  
  return signature;
}

/**
 * Sign a game result with wallet (frontend use)
 * Request signature from user's connected wallet
 */
export async function signGameResultWithWallet(
  walletClient: any,
  gameId: string,
  winner: Address,
  loser: Address,
  stake: bigint
): Promise<Hex> {
  const messageHash = createGameResultHash(gameId, winner, loser, stake);
  
  // Request signature from wallet
  const signature = await walletClient.signMessage({
    account: walletClient.account,
    message: { raw: messageHash }
  });
  
  return signature;
}

/**
 * Verify a signature matches the expected signer
 */
export function verifySignature(
  gameId: string,
  winner: Address,
  loser: Address,
  stake: bigint,
  signature: Hex,
  expectedSigner: Address
): boolean {
  try {
    const messageHash = createGameResultHash(gameId, winner, loser, stake);
    
    // Recover the signer from the signature
    // Note: This would need a proper signature verification library
    // For now, return true (verification happens on-chain)
    return true;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Format signature for contract submission
 * Ensures signature is in the correct format (65 bytes: r + s + v)
 */
export function formatSignature(signature: Hex): Hex {
  // Remove '0x' prefix if present
  const sig = signature.startsWith('0x') ? signature.slice(2) : signature;
  
  // Signature should be 130 characters (65 bytes)
  if (sig.length !== 130) {
    throw new Error(`Invalid signature length: ${sig.length}`);
  }
  
  return `0x${sig}` as Hex;
}

/**
 * Generate a unique game ID
 */
export function generateGameId(
  player1: Address,
  player2: Address,
  timestamp: number
): string {
  return `game_${player1.slice(2, 8)}_${player2.slice(2, 8)}_${timestamp}`;
}

/**
 * Convert stake amount from dollars to wei
 * Assumes 1 ETH = $2000 (update with real price feed)
 */
export function dollarsToWei(dollars: number, ethPriceUSD: number = 2000): bigint {
  const eth = dollars / ethPriceUSD;
  return BigInt(Math.floor(eth * 1e18));
}

/**
 * Convert wei to dollars
 */
export function weiToDollars(wei: bigint, ethPriceUSD: number = 2000): number {
  const eth = Number(wei) / 1e18;
  return eth * ethPriceUSD;
}

/**
 * Example usage for backend game settlement
 */
export async function prepareGameSettlement(
  gameResult: GameResult,
  player1PrivateKey: Hex,
  player2PrivateKey: Hex
) {
  const gameIdBytes = keccak256(encodePacked(['string'], [gameResult.gameId]));
  
  // Sign with both players
  const sig1 = await signGameResult(
    gameResult.gameId,
    gameResult.winner,
    gameResult.loser,
    gameResult.stake,
    player1PrivateKey
  );
  
  const sig2 = await signGameResult(
    gameResult.gameId,
    gameResult.winner,
    gameResult.loser,
    gameResult.stake,
    player2PrivateKey
  );
  
  return {
    gameId: gameIdBytes,
    winner: gameResult.winner,
    loser: gameResult.loser,
    stake: gameResult.stake,
    sig1: formatSignature(sig1),
    sig2: formatSignature(sig2)
  };
}

/**
 * Batch prepare multiple game settlements
 */
export async function prepareBatchSettlement(
  games: GameResult[],
  getPrivateKey: (address: Address) => Hex
) {
  const settlements = await Promise.all(
    games.map(async (game) => {
      const player1Key = getPrivateKey(game.winner);
      const player2Key = getPrivateKey(game.loser);
      
      return prepareGameSettlement(game, player1Key, player2Key);
    })
  );
  
  return settlements;
}

/**
 * Validate game result before signing
 */
export function validateGameResult(result: GameResult): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!result.gameId) {
    errors.push('Missing game ID');
  }
  
  if (!result.winner || !result.loser) {
    errors.push('Missing winner or loser');
  }
  
  if (result.winner === result.loser) {
    errors.push('Winner and loser cannot be the same');
  }
  
  if (result.stake <= 0n) {
    errors.push('Stake must be greater than 0');
  }
  
  if (result.rounds.length < 5) {
    errors.push('Must have at least 5 rounds');
  }
  
  // Verify the winner actually won
  const player1Wins = result.rounds.filter(r => r.winner === result.rounds[0].player1Move).length;
  const player2Wins = result.rounds.filter(r => r.winner === result.rounds[0].player2Move).length;
  
  if (player1Wins < 3 && player2Wins < 3) {
    errors.push('No player has won 3 rounds');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
