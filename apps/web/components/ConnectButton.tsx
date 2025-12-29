"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "./ui/button";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
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

  return (
    <div className="flex flex-col gap-2">
      {connectors.map((connector) => (
        <Button
          key={connector.uid}
          variant="doodle"
          onClick={() => connect({ connector })}
        >
          Connect {connector.name}
        </Button>
      ))}
    </div>
  );
}

