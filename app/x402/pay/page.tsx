"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { processX402Payment } from "@/lib/x402";
import type { X402PaymentResponse } from "@/lib/x402";

export default function X402PayPage() {
  const searchParams = useSearchParams();
  const [paymentRequest, setPaymentRequest] = useState<X402PaymentResponse | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txHash?: string } | null>(null);

  useEffect(() => {
    const requestParam = searchParams.get("request");
    if (requestParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(requestParam));
        // Reconstruct payment response
        setPaymentRequest(parsed as any);
      } catch (error) {
        console.error("Failed to parse payment request:", error);
      }
    }
  }, [searchParams]);

  const handlePay = async () => {
    if (!paymentRequest) return;

    setProcessing(true);
    try {
      const result = await processX402Payment(paymentRequest);
      setResult(result);
    } catch (error) {
      console.error("Payment failed:", error);
      setResult({ success: false });
    } finally {
      setProcessing(false);
    }
  };

  if (!paymentRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl">Invalid payment request</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="doodle-card max-w-md w-full">
        <h1 className="text-3xl font-doodle font-bold mb-6 text-center">
          💰 Payment Request
        </h1>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-600">Amount:</span>
            <span className="font-bold">{paymentRequest.paymentRequest.amount} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Recipient:</span>
            <span className="font-mono text-sm">
              {paymentRequest.paymentRequest.recipient.slice(0, 6)}...
              {paymentRequest.paymentRequest.recipient.slice(-4)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Network:</span>
            <span>Base</span>
          </div>
        </div>

        {result ? (
          <div className="text-center">
            {result.success ? (
              <div className="space-y-4">
                <p className="text-green-600 text-xl font-bold">✅ Payment Successful!</p>
                {result.txHash && (
                  <p className="text-sm text-gray-600">
                    TX: {result.txHash.slice(0, 10)}...
                  </p>
                )}
                <Button
                  variant="doodle"
                  onClick={() => window.close()}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-red-600 text-xl font-bold">❌ Payment Failed</p>
                <Button
                  variant="doodle"
                  onClick={handlePay}
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Button
            variant="doodle"
            onClick={handlePay}
            disabled={processing}
            className="w-full"
          >
            {processing ? "Processing..." : "Pay with x402"}
          </Button>
        )}
      </div>
    </div>
  );
}

