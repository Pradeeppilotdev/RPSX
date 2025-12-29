import { useAccount, useBalance, useWalletClient } from "wagmi";
import { parseEther, formatEther } from "viem";
import { RPSPoolContract } from "@/lib/contract/contractIntegration";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { data: walletClient } = useWalletClient();

  const getContract = () => {
    if (!walletClient) return null;
    return new RPSPoolContract(walletClient);
  };

  const deposit = async (amountEth: string) => {
    const contract = getContract();
    if (!contract) throw new Error("Wallet not connected");
    return await contract.deposit(amountEth);
  };

  const withdraw = async (amountEth: string) => {
    const contract = getContract();
    if (!contract) throw new Error("Wallet not connected");
    return await contract.withdraw(amountEth);
  };

  const withdrawAll = async () => {
    const contract = getContract();
    if (!contract) throw new Error("Wallet not connected");
    return await contract.withdrawAll();
  };

  const getPoolBalance = async () => {
    if (!address) return "0";
    const contract = getContract();
    if (!contract) return "0";
    return await contract.getBalanceFormatted(address);
  };

  return {
    address,
    isConnected,
    balance: balance ? parseFloat(balance.formatted) : 0,
    deposit,
    withdraw,
    withdrawAll,
    getPoolBalance,
  };
}

