"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected, metaMask, walletConnect } from "wagmi/connectors";
import { useState } from "react";

// Build connectors array - only include WalletConnect if project ID is provided
const connectors = [
  injected(),
  metaMask(),
];

// Only add WalletConnect if project ID is configured (suppresses 403 errors)
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (walletConnectProjectId && walletConnectProjectId.trim() !== "") {
  connectors.push(walletConnect({ projectId: walletConnectProjectId }));
}

const config = createConfig({
  chains: [process.env.NEXT_PUBLIC_CHAIN_ID === "84532" ? baseSepolia : base],
  connectors,
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

