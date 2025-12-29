"use client";

import { useAccount, useBalance } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import { DepositModal } from "@/components/DepositModal";
import { GameLobby } from "@/components/GameLobby";
import { useState, useEffect } from "react";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const [showDeposit, setShowDeposit] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only checking connection after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial client render, always show the not-connected view
  // This ensures server and client render the same HTML initially
  if (!mounted || !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-6xl font-doodle font-bold mb-4">
            🎮 Rock Paper Scissors
          </h1>
          <p className="text-xl mb-8 text-gray-600">
            Play onchain on Base
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-doodle font-bold mb-2">
            🎮 Rock Paper Scissors
          </h1>
          <div className="flex items-center justify-center gap-4">
            <div className="doodle-card inline-block">
              <p className="text-sm text-gray-600">Balance</p>
              <p className="text-2xl font-bold">
                {balance ? `${parseFloat(balance.formatted).toFixed(4)} ETH` : "0 ETH"}
              </p>
            </div>
            <button
              onClick={() => setShowDeposit(true)}
              className="doodle-button"
            >
              Deposit
            </button>
          </div>
        </header>

        <GameLobby address={address!} />

        {showDeposit && (
          <DepositModal
            onClose={() => setShowDeposit(false)}
            address={address!}
          />
        )}
      </div>
    </div>
  );
}

