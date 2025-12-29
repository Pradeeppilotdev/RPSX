"use client";

import { useState, useEffect } from "react";
import { parseEther } from "viem";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import {
  requestX402Payment,
  processX402Payment,
  isX402Available,
} from "@/lib/x402";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const ABI = [
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export function DepositModal({
  onClose,
  address,
}: {
  onClose: () => void;
  address: string;
}) {
  const [amount, setAmount] = useState("0.01");
  const [useX402, setUseX402] = useState(false);
  const [x402Available, setX402Available] = useState(false);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    setX402Available(isX402Available());
    setUseX402(isX402Available()); // Auto-enable if available
  }, []);

  const handleDeposit = async () => {
    if (useX402 && x402Available) {
      // Use x402 protocol for seamless payment
      try {
        const paymentRequest = await requestX402Payment(address, amount);
        const result = await processX402Payment(paymentRequest);
        
        if (result.success) {
          // Payment successful via x402
          setTimeout(() => {
            onClose();
            window.location.reload(); // Refresh to update balance
          }, 2000);
        }
      } catch (error) {
        console.error("x402 payment failed:", error);
        // Fallback to standard wallet transaction
        handleStandardDeposit();
      }
    } else {
      handleStandardDeposit();
    }
  };

  const handleStandardDeposit = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "deposit",
      value: parseEther(amount),
    });
  };

  if (isSuccess) {
    setTimeout(() => {
      onClose();
    }, 2000);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="doodle-card">
        <DialogHeader>
          <DialogTitle className="text-3xl font-doodle">Deposit Funds</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Amount (ETH)
            </label>
            <input
              type="number"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 border-2 border-black rounded"
            />
          </div>
          <div className="flex gap-2">
            {["0.005", "0.01", "0.02"].map((val) => (
              <Button
                key={val}
                variant="outline"
                onClick={() => setAmount(val)}
                className="flex-1"
              >
                {val} ETH
              </Button>
            ))}
          </div>
          
          {x402Available && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border-2 border-black">
              <input
                type="checkbox"
                id="use-x402"
                checked={useX402}
                onChange={(e) => setUseX402(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="use-x402" className="text-sm">
                Use x402 for seamless payment (no wallet popup)
              </label>
            </div>
          )}

          <Button
            variant="doodle"
            onClick={handleDeposit}
            disabled={isPending || isConfirming}
            className="w-full"
          >
            {isPending || isConfirming
              ? "Processing..."
              : useX402 && x402Available
              ? "Pay with x402"
              : "Deposit"}
          </Button>
          {isSuccess && (
            <p className="text-green-600 text-center">Deposit successful!</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

