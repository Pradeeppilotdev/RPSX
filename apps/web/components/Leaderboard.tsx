"use client";

import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "@rps/shared";

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/leaderboard`)
      .then((res) => res.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return <div className="text-center">Loading leaderboard...</div>;
  }

  return (
    <div className="doodle-card">
      <h2 className="text-3xl font-doodle font-bold mb-6 text-center">
        🏆 Leaderboard
      </h2>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.address}
            className="flex items-center justify-between p-4 border-2 border-black rounded"
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold">#{entry.rank}</span>
              <div>
                <p className="font-bold">
                  {entry.username || `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`}
                </p>
                <p className="text-sm text-gray-600">
                  {entry.wins} wins • ${entry.earnings.toFixed(2)} • {entry.streak} streak
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

