import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { constants } from "starknet";
import {
  useAccount,
  useDisconnect,
  useZtarknetConnect,
  useZtarknetCreate,
} from "@/contract/WalletConnector";
import { useZtarknetConnector } from "@/context/ZtarknetConnector";
import { BasicTab } from "./basic";
import {
  getLeaderboardPixelsUser,
  getLeaderboardWorldUser,
  getUserRewards,
} from "../../api/stats";
import copyIcon from "../../../public/icons/copy.png";
import muteIcon from "../../../public/icons/mute.png";
import unmuteIcon from "../../../public/icons/unmute.png";
import {
  getSoundEffectVolume,
  setSoundEffectVolume,
  getMusicVolume,
  setMusicVolume,
  playSoftClick2,
} from "../utils/sounds";
import { DeleteAccountModal } from "./delete-account-modal";
import { DeleteAllAccountsModal } from "./delete-all-accounts-modal";
import { FundAccountModal } from "./fund-account-modal";

export const AccountTab = (props: any) => {
  const { address, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, getAvailableKeys, getPrivateKey, clearPrivateKey, clearPrivateKeys, setFundingCallback, getBalance } = useZtarknetConnect();
  const { createAccount } = useZtarknetCreate();
  const { username: ztarknetUsername, claimUsername, isUsernameClaimed } = useZtarknetConnector();

  const [addressShort, setAddressShort] = useState<string>();
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showDeleteAllAccountsModal, setShowDeleteAllAccountsModal] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [fundingAddress, setFundingAddress] = useState<string>("");
  const [fundingResolve, setFundingResolve] = useState<(() => void) | null>(null);
  const [fundingReject, setFundingReject] = useState<((reason?: any) => void) | null>(null);

  // Username claiming states
  const [showUsernameClaim, setShowUsernameClaim] = useState(false);
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [isClaimingUsername, setIsClaimingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string>("");

  // Create funding callback using useCallback to avoid recreating on every render
  const fundingCallback = useCallback((accountAddress: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      setFundingAddress(accountAddress);
      setShowFundingModal(true);
      setFundingResolve(() => resolve);
      setFundingReject(() => reject);
    });
  }, []);

  // Register funding callback for modal-based funding
  useEffect(() => {
    setFundingCallback(fundingCallback);

    // Cleanup on unmount
    return () => {
      setFundingCallback(null);
    };
  }, [setFundingCallback, fundingCallback]);

  // Load available accounts on mount and when disconnecting
  useEffect(() => {
    const loadAvailableAccounts = () => {
      const keyIds = getAvailableKeys();
      setAvailableAccounts(keyIds);
    };
    loadAvailableAccounts();
  }, [address, getAvailableKeys]);

  useEffect(() => {
    if (!address) return;
    setAddressShort(`${address.slice(0, 6)}...${address.slice(-4)}`);
  }, [address]);

  // Handle username claim
  const handleClaimUsername = async () => {
    if (!usernameInput || usernameInput.trim() === "") {
      setUsernameError("Username cannot be empty");
      return;
    }

    // Validate username format (a-z, 0-9, -, _)
    const usernameRegex = /^[a-z0-9_-]+$/;
    if (!usernameRegex.test(usernameInput)) {
      setUsernameError("Username can only contain lowercase letters, numbers, hyphens, and underscores");
      return;
    }

    if (usernameInput.length > 31) {
      setUsernameError("Username must be 31 characters or less");
      return;
    }

    setIsClaimingUsername(true);
    setUsernameError("");

    try {
      // Check if username is already taken
      const isTaken = await isUsernameClaimed(usernameInput);
      if (isTaken) {
        setUsernameError("Username is already taken");
        setIsClaimingUsername(false);
        return;
      }

      // Claim the username
      const txHash = await claimUsername(usernameInput);
      if (txHash) {
        console.log("Username claimed successfully:", txHash);
        setShowUsernameClaim(false);
        setUsernameInput("");
        playSoftClick2();
      } else {
        setUsernameError("Failed to claim username. Please try again.");
      }
    } catch (error) {
      console.error("Error claiming username:", error);
      setUsernameError("Failed to claim username. Please try again.");
    } finally {
      setIsClaimingUsername(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Extract address from key ID
  // Key ID format: {network}.{appName}.{accountClassName}.{address}
  const extractAddressFromKeyId = (keyId: string): string => {
    const parts = keyId.split('.');
    return parts[parts.length - 1]; // Last part is the address
  };

  // Connect to a specific account by key ID
  const connectToAccount = async (keyId: string) => {
    try {
      playSoftClick2();
      const privateKey = getPrivateKey(keyId);
      if (privateKey) {
        await connect(privateKey);
        console.log("Connected to account:", keyId);
      } else {
        console.error("Private key not found for:", keyId);
      }
    } catch (error) {
      console.error("Failed to connect to account:", error);
      alert("Failed to connect to account. Please try again.");
    }
  };

  // Delete current account and logout
  const deleteCurrentAccount = () => {
    if (!address) return;

    // Find the key ID for the current address
    const currentKeyId = availableAccounts.find(keyId =>
      extractAddressFromKeyId(keyId).toLowerCase() === address.toLowerCase()
    );

    if (currentKeyId) {
      clearPrivateKey(currentKeyId);
      console.log("Deleted account:", currentKeyId);
    }

    // Disconnect
    disconnect();
  };

  // Delete all accounts and refresh the list
  const deleteAllAccounts = () => {
    clearPrivateKeys();
    setAvailableAccounts([]); // Clear the UI list immediately
    console.log("All accounts deleted");
  };

  // Open delete account modal
  const handleDeleteAccountClick = () => {
    playSoftClick2();
    setShowDeleteAccountModal(true);
  };

  // Open delete all accounts modal
  const handleDeleteAllAccountsClick = () => {
    playSoftClick2();
    setShowDeleteAllAccountsModal(true);
  };

  // Handle funding modal completion
  const handleFundingComplete = () => {
    setShowFundingModal(false);
    if (fundingResolve) {
      fundingResolve();
      setFundingResolve(null);
      setFundingReject(null);
    }
  };

  // Handle funding modal cancellation
  const handleFundingCancel = () => {
    setShowFundingModal(false);
    if (fundingReject) {
      fundingReject(new Error("User cancelled funding"));
      setFundingReject(null);
    }
    setFundingResolve(null);
  };

  // Wrapper for getBalance to be used by the modal
  const checkFundingBalance = async () => {
    return await getBalance(fundingAddress);
  };

  // Create new Ztarknet account
  const createZtarknetAccount = async () => {
    try {
      setIsCreatingAccount(true);
      playSoftClick2();

      // Create account
      const { address: newAddress, privateKey } = await createAccount();
      console.log("Account created:", newAddress);

      // Connect to the new account
      await connect(privateKey);
      console.log("Connected to new account");
    } catch (error) {
      console.error("Failed to create account:", error);
      // Don't show alert if user cancelled funding
      if (error instanceof Error && error.message.includes("cancelled")) {
        console.log("Account creation cancelled by user");
      } else {
        alert("Failed to create account. Please try again.");
      }
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const [totalPixelsPlaced, setTotalPixelsPlaced] = useState<number>(0);
  const [pixelsOnWorld, setPixelsOnWorld] = useState<number>(0);
  useEffect(() => {
    if (!address) return;
    //TODO
    console.log("TODO: Fetch total pixels placed and pixels on world");
  }, [address]);

  useEffect(() => {
    const getStats = async () => {
      if (!address) return;
      const leaderboardPixelsUser = await getLeaderboardPixelsUser(
        address.slice(2)
      );
      const leaderboardPixelsWorldUser = await getLeaderboardWorldUser(
        address.slice(2),
        props.activeWorld?.worldId
      );
      setTotalPixelsPlaced(leaderboardPixelsUser ? leaderboardPixelsUser : 0);
      setPixelsOnWorld(
        leaderboardPixelsWorldUser ? leaderboardPixelsWorldUser : 0
      );
    };
    getStats();
  }, [address, props.activeWorld]);

  const [isFXMuted, setIsFXMuted] = useState<boolean>(
    getSoundEffectVolume() === 0
  );
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(
    getMusicVolume() === 0
  );

  const mockUserRewards = [
    { amount: 1000, type: "42nd place artwork!" },
    { amount: 100, type: "Honorable mention" },
  ];
  const [userRewards, setUserRewards] = useState<any>();
  useEffect(() => {
    if (!address) return;
    const fetchUserRewards = async () => {
      const rewards = await getUserRewards(address.slice(2).toLowerCase());
      setUserRewards(rewards);
    };
    fetchUserRewards();
  }, [address]);
  const [showClaim, setShowClaim] = useState<boolean>(false);
  const claimLink =
    "https://github.com/keep-starknet-strange/art-peace/issues/283";
  const openClaimTab = () => {
    window.open(claimLink, "_blank");
  };

  return (
    <BasicTab title="Account" {...props}>
      {!address && (
        <div className="flex flex-col align-center justify-center w-full gap-[0.5rem] px-[1rem] my-[2rem]">
          {/* Available Accounts List */}
          {availableAccounts.length > 0 && (
            <div className="w-full mb-[1rem]">
              <p className="Text__medium text-center mb-[0.5rem]">Available Accounts</p>
              {availableAccounts.map((keyId, index) => {
                const accountAddress = extractAddressFromKeyId(keyId);
                const addressShort = `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}`;
                return (
                  <div
                    key={keyId}
                    className={`w-[100%] py-[0.7rem] px-[1rem] mb-[0.5rem] Text__medium Button__primary ${isCreatingAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={isCreatingAccount ? undefined : () => connectToAccount(keyId)}
                  >
                    <div className="flex flex-col align-center justify-center gap-[0.2rem]">
                      <p className="Text__large">Connect Account {index + 1}</p>
                      <p className="Text__small text-gray-600">{addressShort}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Account Button */}
          <div
            className={`w-[100%] py-[0.7rem] px-[1rem] Text__medium Button__primary ${isCreatingAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={isCreatingAccount ? undefined : createZtarknetAccount}
          >
            <div className="flex flex-col align-center justify-center gap-[0.5rem]">
              <p className="Text__large">
                {isCreatingAccount ? "Creating Account..." : "Create Account"}
              </p>
              <p className="Txt__small text-blue-500">Embedded Ztarknet!</p>
            </div>
          </div>

          {/* Delete All Accounts Button */}
          {availableAccounts.length > 0 && (
            <div
              className={`w-[100%] py-[0.7rem] px-[1rem] Text__medium Button__primary ${isCreatingAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={isCreatingAccount ? undefined : handleDeleteAllAccountsClick}
            >
              <p className="Text__large">
                {isCreatingAccount
                  ? "Please wait..."
                  : "Delete All Accounts"}
              </p>
            </div>
          )}
        </div>
      )}
      {address && (
        <div className="flex flex-col w-full mt-[1rem]">
          <div className="px-[0.5rem] mx-[0.5rem] flex flex-row align-center justify-between">
            <p className="Text__medium pr-[1rem]">Chain:</p>
            <p className="Text__medium pr-[0.5rem] truncate w-[21rem] text-right">
              {chain}
            </p>
          </div>
          <div className="px-[0.5rem] mx-[0.5rem] mt-[1rem] flex flex-row align-center justify-between">
            <p className="Text__medium pr-[1rem]">Username:</p>
            <div className="flex flex-row align-center gap-[0.5rem]">
              <p className="Text__medium pr-[0.5rem] truncate w-[15rem] text-right">
                {ztarknetUsername || "Not set"}
              </p>
              {!ztarknetUsername && !showUsernameClaim && (
                <button
                  className="px-[0.5rem] py-[0.2rem] Text__small Button__primary"
                  onClick={() => {
                    playSoftClick2();
                    setShowUsernameClaim(true);
                  }}
                >
                  Claim
                </button>
              )}
            </div>
          </div>

          {/* Username Claim Form */}
          {showUsernameClaim && (
            <div className="px-[0.5rem] mx-[0.5rem] mt-[1rem] p-[1rem] border-2 border-black bg-gray-100">
              <h3 className="Text__large mb-[0.5rem]">Claim Username</h3>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value.toLowerCase())}
                placeholder="Enter username"
                className="w-full p-[0.5rem] border-2 border-black Text__medium mb-[0.5rem]"
                disabled={isClaimingUsername}
              />
              {usernameError && (
                <p className="Text__small text-red-600 mb-[0.5rem]">{usernameError}</p>
              )}
              <p className="Text__small text-gray-600 mb-[0.5rem]">
                Only lowercase letters, numbers, hyphens, and underscores allowed (max 31 characters)
              </p>
              <div className="flex flex-row gap-[0.5rem]">
                <button
                  className="flex-1 px-[0.5rem] py-[0.5rem] Text__medium Button__primary"
                  onClick={handleClaimUsername}
                  disabled={isClaimingUsername}
                >
                  {isClaimingUsername ? "Claiming..." : "Claim"}
                </button>
                <button
                  className="flex-1 px-[0.5rem] py-[0.5rem] Text__medium Button__primary"
                  onClick={() => {
                    playSoftClick2();
                    setShowUsernameClaim(false);
                    setUsernameInput("");
                    setUsernameError("");
                  }}
                  disabled={isClaimingUsername}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div className="px-[0.5rem] mx-[0.5rem] mt-[1rem] flex flex-row align-center justify-between">
            <p className="Text__medium pr-[1rem]">Address&nbsp;:</p>
            <div className="flex flex-row align-center flex-grow">
              <p className="Text__medium pr-[0.5rem] truncate text-right w-[100%]">
                {addressShort}
              </p>
              <div
                className="w-[2rem] h-[2rem] cursor-pointer"
                onClick={() => {
                  playSoftClick2();
                  copyToClipboard(address);
                }}
              >
                <Image src={copyIcon} alt="Copy icon" />
              </div>
            </div>
          </div>
          <div className="px-[0.5rem] mx-[0.5rem] mt-[1rem] flex flex-row align-center justify-between">
            <p className="Text__medium pr-[1rem]">Network&nbsp;:</p>
            <p className="Text__medium pr-[0.5rem] text-right">
              {process.env.NEXT_PUBLIC_ZTARKNET_NETWORK === "ZTARKNET_TESTNET"
                ? "Ztarknet"
                : "Ztarknet Devnet"}
            </p>
          </div>

          <div className="border-y-2 border-black mx-[1rem] mt-[1rem] py-[1rem]">
            <h2 className="Text__large Heading__sub p-[0.5rem] mb-[1rem]">
              Stats
            </h2>
            <div className="mx-[1rem]">
              <h3 className="text-black text-xl truncate underline mb-[1rem]">
                Totals
              </h3>
              <div className="px-[0.5rem] mx-[0.5rem] flex flex-row align-center justify-between">
                <p className="Text__medium pr-[1rem]">Pixels Placed&nbsp;:</p>
                <p className="Text__medium pr-[0.5rem] text-right">
                  {totalPixelsPlaced}
                </p>
              </div>
              {props.activeWorld && (
                <>
                  <h3 className="text-black text-xl truncate underline mt-[1rem] mb-[1rem]">
                    On World &quot;{props.activeWorld.name}&quot;
                  </h3>
                  <div className="px-[0.5rem] mx-[0.5rem] flex flex-row align-center justify-between">
                    <p className="Text__medium pr-[1rem]">
                      Pixels Placed&nbsp;:
                    </p>
                    <p className="Text__medium pr-[0.5rem] text-right">
                      {pixelsOnWorld}
                    </p>
                  </div>
                </>
              )}
              {userRewards && !showClaim && (
                <div className="mt-[2rem] flex flex-row align-center justify-around">
                  <div>
                    <p className="text-[2rem] text-blue-500">Congrats!</p>
                    <p className="text-[1.2rem] text-green-600">
                      You won an award!
                    </p>
                  </div>
                  <div className="Button__primary">
                    <p
                      className="Text__large"
                      onClick={() => setShowClaim(true)}
                    >
                      Claim
                    </p>
                  </div>
                </div>
              )}
              {userRewards && showClaim && (
                <div className="mt-[2rem]">
                  <h3 className="text-black text-[2rem] text-blue-500">
                    Rewards
                  </h3>
                  <div className="mb-[1rem]">
                    {userRewards.map((reward: any, index: number) => (
                      <div
                        key={index}
                        className="flex flex-row align-center justify-between mx-[1rem]"
                      >
                        <p className="Text__medium pr-[1rem]">{reward.type}</p>
                        <p className="Text__medium pr-[0.5rem] text-right">
                          {reward.amount} STRK
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-row align-center justify-center mx-[1rem] mb-[1rem]">
                    <p className="Text__large pr-[1rem]">Total:</p>
                    <p className="Text__large pr-[0.5rem] text-right">
                      {userRewards.reduce(
                        (acc: number, reward: any) => acc + reward.amount,
                        0
                      )}{" "}
                      STRK
                    </p>
                  </div>
                  <div className="Button__primary">
                    <p className="Text__large" onClick={openClaimTab}>
                      Claim
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="mx-[1rem] mt-[1rem] py-[1rem]">
        <h2 className="Text__large Heading__sub px-[0.5rem]">Settings</h2>
        <div className="px-[0.5rem] ml-[0.5rem] mr-[1rem] flex flex-row align-center justify-around mt-[1rem]">
          <div className="flex flex-row align-center">
            <p className="Text__medium pr-[1rem] my-auto">Sound FX</p>
            <Image
              src={isFXMuted ? muteIcon : unmuteIcon}
              alt="Mute icon"
              onClick={() => {
                playSoftClick2();
                const newVolume = isFXMuted ? 1 : 0;
                setSoundEffectVolume(newVolume);
                setIsFXMuted(!isFXMuted);
              }}
              className="cursor-pointer h-[2.5rem] w-[2.5rem] hover:scale-105"
            />
          </div>
          <div className="flex flex-row align-center">
            <p className="Text__medium pr-[1rem] my-auto">Music</p>
            <Image
              src={isMusicMuted ? muteIcon : unmuteIcon}
              alt="Mute icon"
              onClick={() => {
                playSoftClick2();
                const newVolume = isMusicMuted ? 1 : 0;
                props.setIsMusicMuted(newVolume === 0);
                setMusicVolume(newVolume);
                setIsMusicMuted(!isMusicMuted);
              }}
              className="cursor-pointer h-[2.5rem] w-[2.5rem] hover:scale-105"
            />
          </div>
        </div>
      </div>
      {address && (
        <div className="flex flex-row align-center justify-center gap-[1rem] w-full pt-[2rem] px-[1rem]">
          <button
            className="flex-1 py-[0.7rem] px-[1rem] Text__medium Button__primary"
            onClick={handleDeleteAccountClick}
          >
            Delete Account
          </button>
          <button
            className="flex-1 py-[0.7rem] px-[1rem] Text__medium Button__primary"
            onClick={() => {
              playSoftClick2();
              disconnect();
            }}
          >
            Logout
          </button>
        </div>
      )}

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
        onConfirm={deleteCurrentAccount}
      />

      {/* Delete All Accounts Modal */}
      <DeleteAllAccountsModal
        isOpen={showDeleteAllAccountsModal}
        onClose={() => setShowDeleteAllAccountsModal(false)}
        onConfirm={deleteAllAccounts}
      />

      {/* Fund Account Modal */}
      <FundAccountModal
        isOpen={showFundingModal}
        accountAddress={fundingAddress}
        onFunded={handleFundingComplete}
        onCancel={handleFundingCancel}
        checkBalance={checkFundingBalance}
      />
    </BasicTab>
  );
};
