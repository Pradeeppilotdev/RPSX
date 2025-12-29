"use client";

import { useEffect, useState } from "react";
import { pusher, subscribeToGame, subscribeToMatchmaking } from "@/lib/pusher/client";
import type { GameCallbacks } from "@/lib/pusher/client";

export function usePusher() {
  const [connected, setConnected] = useState(false);
  const [errorLogged, setErrorLogged] = useState(false);

  useEffect(() => {
    // Check if Pusher is properly initialized
    if (!pusher || typeof pusher.connection === 'undefined') {
      // Only warn once, not on every render
      if (!errorLogged) {
        console.warn("Pusher not initialized - check NEXT_PUBLIC_PUSHER_KEY in .env.local");
        setErrorLogged(true);
      }
      return;
    }

    // Check initial connection state
    if (pusher.connection.state === 'connected') {
      setConnected(true);
    }

    pusher.connection.bind("connected", () => {
      console.log("Pusher connected");
      setConnected(true);
      setErrorLogged(false); // Reset error flag on successful connection
    });

    pusher.connection.bind("disconnected", () => {
      console.log("Pusher disconnected");
      setConnected(false);
    });

    pusher.connection.bind("error", (err: any) => {
      // Only log error once to avoid spam
      if (!errorLogged) {
        const errorType = err?.type || err?.error || "Unknown error";
        // Don't log generic PusherError (common connection retry errors)
        // Only log if it's a meaningful error
        if (errorType !== "PusherError" || (err?.data?.code && err.data.code !== 1006)) {
          console.warn("Pusher connection issue (real-time updates may be delayed). Game will still work via API.");
        }
        setErrorLogged(true);
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
  }, [errorLogged]);

  return {
    pusher,
    connected,
    subscribeToGame,
    subscribeToMatchmaking,
  };
}

