# RPSPool Smart Contract

Pool-based Rock Paper Scissors game contract on Base mainnet.

## Features

- **Pool Deposits**: Deposit once, play many games
- **Batch Settlement**: Settle up to 50 games in one transaction
- **Signature Verification**: Secure offchain gameplay
- **3% Fee**: Taken from winner's payout
- **Emergency Controls**: Pause and emergency withdraw

## Contract Functions

### User Functions

- `deposit()` - Deposit funds to pool
- `withdraw(uint256 amount)` - Withdraw from pool
- `settleGame(...)` - Settle single game
- `batchSettle(...)` - Settle multiple games

### Admin Functions

- `pause()` / `unpause()` - Emergency controls
- `setMinDeposit(uint256)` - Update minimum deposit
- `withdrawFees()` - Collect fees

## Testing

```bash
forge test --gas-report
```

## Deployment

```bash
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

## Gas Costs

- Deposit: ~50k gas
- Withdraw: ~50k gas
- Single settlement: ~80k gas
- Batch settlement (20 games): ~300k gas (~15k per game)

