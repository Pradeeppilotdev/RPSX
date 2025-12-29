"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only checking connection after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial client render, always show the not-connected view
  // This ensures server and client render the same HTML initially
  if (!mounted || !isConnected) {
    // Show placeholder during SSR, actual buttons after mount
    if (!mounted) {
      return (
        <div className="flex flex-col gap-2">
          <Button variant="doodle" disabled>
            Connect Wallet
          </Button>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col gap-2">
        {connectors.length > 0 ? (
          connectors.map((connector) => (
            <Button
              key={connector.uid}
              variant="doodle"
              onClick={() => connect({ connector })}
            >
              Connect {connector.name}
            </Button>
          ))
        ) : (
          <Button variant="doodle" disabled>
            No wallets available
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-600">
        Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
      </p>
      <Button variant="doodle" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  );
}

