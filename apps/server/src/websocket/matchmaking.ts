import { Server, Socket } from "socket.io";

type QueuedPlayer = {
  socket: Socket;
  address: string;
  stake: number;
  joinedAt: number;
};

type Match = {
  player1: QueuedPlayer;
  player2: QueuedPlayer;
  stake: number;
};

export class MatchmakingQueue {
  private queues: Map<number, QueuedPlayer[]> = new Map();

  addPlayer(socket: Socket, address: string, stake: number): Match | null {
    const queue = this.getQueue(stake);
    
    // Check for existing match
    if (queue.length > 0) {
      const opponent = queue.shift()!;
      
      return {
        player1: opponent,
        player2: { socket, address, stake, joinedAt: Date.now() },
        stake,
      };
    }

    // Add to queue
    queue.push({ socket, address, stake, joinedAt: Date.now() });
    return null;
  }

  removePlayer(socketId: string): void {
    for (const queue of this.queues.values()) {
      const index = queue.findIndex((p) => p.socket.id === socketId);
      if (index !== -1) {
        queue.splice(index, 1);
        return;
      }
    }
  }

  private getQueue(stake: number): QueuedPlayer[] {
    if (!this.queues.has(stake)) {
      this.queues.set(stake, []);
    }
    return this.queues.get(stake)!;
  }
}

