"use client";

import { useEffect, useState } from "react";
import { pusher, subscribeToGame, subscribeToMatchmaking } from "@/lib/pusher/client";
import type { GameCallbacks } from "@/lib/pusher/client";

export function usePusher() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Check if Pusher is properly initialized
    if (!pusher || !pusher.connection) {
      return;
    }

    // Check initial connection state
    if (pusher.connection.state === 'connected') {
      setConnected(true);
    }

    pusher.connection.bind("connected", () => {
      setConnected(true);
    });

    pusher.connection.bind("disconnected", () => {
      setConnected(false);
    });

    pusher.connection.bind("error", (err: any) => {
      // Log connection errors for debugging
      // Filter out common retry errors (code 1006 = abnormal closure during connection)
      const errorCode = err?.data?.code;
      if (errorCode && errorCode !== 1006) {
        console.warn("Pusher connection error:", {
          type: err?.type || "Unknown",
          code: errorCode,
          message: err?.data?.message || err?.message || "Connection error",
        });
      }
      setConnected(false);
    });

    return () => {
      if (pusher && pusher.connection) {
        pusher.connection.unbind("connected");
        pusher.connection.unbind("disconnected");
        pusher.connection.unbind("error");
      }
    };
  }, []);

  return {
    pusher,
    connected,
    subscribeToGame,
    subscribeToMatchmaking,
  };
}

