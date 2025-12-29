# 🎮 Rock Paper Scissors - Farcaster Mini App

Onchain Rock Paper Scissors game built for Farcaster on Base mainnet. Play with friends, compete on the leaderboard, and settle games efficiently with batch settlement.

## 🏗️ Architecture

- **Smart Contracts**: Pool-based system with batch settlement (Base mainnet)
- **Backend**: Bun + Hono + Socket.io for real-time gameplay
- **Frontend**: Next.js 14 + shadcn/ui + black & white doodle theme
- **Database**: PostgreSQL for game history and leaderboard
- **Payments**: ✅ x402 protocol integration for seamless deposits

## 📁 Project Structure

```
RPSX/
├── contracts/          # Smart contracts (Foundry)
│   ├── src/
│   ├── test/
│   └── script/
├── apps/
│   ├── server/         # Backend (Bun + Hono + Socket.io)
│   └── web/            # Frontend (Next.js)
└── packages/
    └── shared/         # Shared types and utilities
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Foundry (for contracts)
- PostgreSQL database
- Base mainnet RPC access

### 1. Install Dependencies

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install contract dependencies
cd contracts
forge install OpenZeppelin/openzeppelin-contracts

# Install app dependencies
cd ../apps/server
bun install

cd ../web
npm install
```

### 2. Setup Database

```bash
# Create database
createdb rps

# Run migrations
cd apps/server
bun run db:migrate
```

### 3. Configure Environment

```bash
# Backend (.env)
cp apps/server/.env.example apps/server/.env
# Edit with your values

# Frontend (.env.local)
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

### 4. Deploy Contracts

```bash
cd contracts

# Testnet
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url base_sepolia \
  --broadcast \
  --verify

# Mainnet
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_mainnet \
  --broadcast \
  --verify
```

### 5. Run Development Servers

```bash
# Terminal 1: Backend
cd apps/server
bun run dev

# Terminal 2: Frontend
cd apps/web
npm run dev
```

## 🎮 Game Flow

1. **Deposit**: Players deposit funds via x402 (seamless) or standard wallet (one-time)
2. **Matchmaking**: Join queue or create private lobby
3. **Play**: 5 rounds of Rock Paper Scissors (offchain)
4. **Settle**: Batch settlement every 10 minutes (or instant)
5. **Withdraw**: Withdraw winnings anytime

## 💳 x402 Payment Integration

The app includes **x402 protocol** integration for seamless payments in Farcaster:

- ✅ **Seamless deposits** - No wallet popups in Farcaster
- ✅ **Automatic detection** - Uses x402 when available, falls back to standard wallet
- ✅ **HTTP 402 standard** - Follows x402 protocol specification
- ✅ **Farcaster native** - Works perfectly in Warpcast app

See `X402_INTEGRATION.md` for details.

## 💰 Cost Structure

- **Deposit**: ~$0.12 (one-time)
- **Play**: Free (offchain)
- **Settlement**: ~$0.08 per game (batched = $0.015)
- **Withdraw**: ~$0.12

**Total for 10 games**: ~$0.24 (2.4% overhead) ✅

## 🔧 Smart Contract Features

- Pool-based deposits (play multiple games)
- Batch settlement (50 games per transaction)
- Signature verification (offchain games, onchain settlement)
- 3% fee on winnings
- Emergency pause functionality

## 🎨 UI Features

- Black & white doodle theme
- shadcn/ui components
- Smooth animations (framer-motion)
- Real-time gameplay (Socket.io)
- Responsive design

## 📊 Leaderboard

- Weekly reset
- Tracks wins, earnings, streaks
- Onchain events + offchain indexing
- Verifiable by replaying events

## 🔒 Security

- Commit-reveal pattern (prevents front-running)
- Signature verification
- Reentrancy guards
- Pausable contract
- Timeout handling

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

