import { useState, useEffect } from "react";
import Image from "next/image";
import { BasicTab } from "./basic";
import { playSoftClick2 } from "../utils/sounds";
import copyIcon from "../../../public/icons/copy.png";

interface FundAccountModalProps {
  isOpen: boolean;
  accountAddress: string;
  onFunded: () => void;
  onCancel: () => void;
  checkBalance: () => Promise<bigint>;
}

const MINIMUM_BALANCE = BigInt("10000000000000000"); // 0.01 tokens (10^16)
const FAUCET_URL = "https://faucet.ztarknet.cash/";
const POLL_INTERVAL = 3000; // 3 seconds

export const FundAccountModal = ({
  isOpen,
  accountAddress,
  onFunded,
  onCancel,
  checkBalance
}: FundAccountModalProps) => {
  const [isChecking, setIsChecking] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<bigint>(BigInt(0));

  useEffect(() => {
    if (!isOpen) {
      setIsChecking(false);
      setCurrentBalance(BigInt(0));
      return;
    }

    setIsChecking(true);

    // Poll balance every 3 seconds
    const pollBalance = async () => {
      try {
        const balance = await checkBalance();
        setCurrentBalance(balance);

        if (balance >= MINIMUM_BALANCE) {
          setIsChecking(false);
          onFunded();
        }
      } catch (error) {
        console.error("Failed to check balance:", error);
      }
    };

    // Check immediately
    pollBalance();

    // Then check every 3 seconds
    const interval = setInterval(pollBalance, POLL_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [isOpen, checkBalance, onFunded]);

  if (!isOpen) return null;

  const handleCancel = () => {
    playSoftClick2();
    onCancel();
  };

  const openFaucet = () => {
    playSoftClick2();
    window.open(FAUCET_URL, "_blank");
  };

  const copyToClipboard = () => {
    playSoftClick2();
    navigator.clipboard.writeText(accountAddress);
  };

  const addressShort = accountAddress ? `${accountAddress.slice(0, 8)}...${accountAddress.slice(-6)}` : "";
  const isFunded = currentBalance >= MINIMUM_BALANCE;

  if (!isOpen || !accountAddress) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 pointer-events-auto">
      <div className="w-[90%] max-w-[600px]">
        <BasicTab title="Setup Account" hideClose={false} onClose={handleCancel}>
          <div className="flex flex-col w-full mt-[1rem] px-[1rem]">
            {/* Description */}
            <div className="flex flex-col w-full mb-[1.5rem]">
              <p className="Text__medium text-black mb-[1rem]">
                New accounts needs gas tokens to setup.
              </p>
              <p className="Text__small text-gray-700">
                Please follow these steps to get your FREE gas!
              </p>
            </div>

            {/* Step-by-step instructions */}
            <div className="flex flex-col w-full mb-[1.5rem] space-y-4 gap-[0.5rem]">
              {/* Step 1 */}
              <div className="flex flex-row flex-1 items-center gap-1">
                <span className="Text__medium text-blue-500 font-bold min-w-[1.5rem]">1.</span>
                <p className="Text__medium text-black">
                  Go to the Ztarknet faucet
                </p>
                <button
                  onClick={openFaucet}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 w-fit ml-6"
                >
                  Open Faucet
                </button>
              </div>

              {/* Step 2 */}
              <div className="flex flex-row gap-1">
                <span className="Text__medium text-blue-500 font-bold min-w-[1.5rem]">2.</span>
                <div className="flex flex-col flex-1">
                  <p className="Text__medium text-black mb-[0.5rem]">
                    Paste your account address into the faucet:
                  </p>
                  <div className="flex flex-row items-center pl-[2rem] cursor-pointer" onClick={copyToClipboard}>
                    <p className="Text__small font-mono truncate mr-[1rem]">
                      {addressShort}
                    </p>
                    <div
                      className="w-[2rem] h-[2rem]"
                    >
                      <Image src={copyIcon} alt="Copy" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-row gap-1">
                <span className="Text__medium text-blue-500 font-bold min-w-[1.5rem]">3.</span>
                <p className="Text__medium text-black">
                  Click &quot;Request STRK&quot;
                </p>
              </div>

              {/* Step 4 */}
              <div className="flex flex-row gap-1">
                <span className="Text__medium text-blue-500 font-bold min-w-[1.5rem]">4.</span>
                <p className="Text__medium text-black">
                  Wait a few seconds for the funds to arrive
                </p>
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex flex-col w-full mb-[1.5rem] p-3 bg-blue-50 border-2 border-blue-300 rounded-lg">
              <div className="flex flex-row items-center justify-between">
                <p className="Text__medium text-black">
                  {isChecking ? "Waiting for funds..." : "Checking balance..."}
                </p>
                {isChecking && !isFunded && (
                  <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                )}
                {isFunded && (
                  <span className="Text__medium text-green-600 font-bold">✓ Funded!</span>
                )}
              </div>
              <p className="Text__small text-gray-600 mt-[0.5rem]">
                Current balance: {(Number(currentBalance) / 1e18).toFixed(4)} STRK
              </p>
            </div>

            {/* Cancel button */}
            <div className="flex flex-row justify-center mb-[1rem]">
              <button
                className="px-8 py-2 text-lg font-semibold text-white bg-gray-500 rounded-xl hover:bg-gray-600"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </BasicTab>
      </div>
    </div>
  );
};
