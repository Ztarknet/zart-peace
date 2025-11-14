import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { constants } from "starknet";
import {
  useAccount,
  useDisconnect,
  useZtarknetConnect,
  useZtarknetCreate,
} from "@/contract/WalletConnector";
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

export const AccountTab = (props: any) => {
  const { address, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, getAvailableKeys, clearAvailableKeys } = useZtarknetConnect();
  const { createAccount, deployAccount } = useZtarknetCreate();

  const [username, setUsername] = useState<string>("");
  const [addressShort, setAddressShort] = useState<string>();
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // Auto-connect if there's an existing account
  useEffect(() => {
    const autoConnect = async () => {
      if (address) return; // Already connected

      const availableKeys = getAvailableKeys();
      if (availableKeys && availableKeys.length > 0) {
        try {
          await connect(availableKeys[0]);
          console.log("Auto-connected to existing account");
        } catch (error) {
          console.error("Failed to auto-connect:", error);
        }
      }
    };

    autoConnect();
  }, []);

  useEffect(() => {
    if (!address) return;

    // TODO: ZTARKNET: Get username from Ztarknet service
    // For now, just show shortened address
    setUsername("N/A");
    setAddressShort(`${address.slice(0, 6)}...${address.slice(-4)}`);
  }, [address]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

      // TODO: Optionally deploy the account on-chain
      // This requires funding the account first
      // const txHash = await deployAccount(privateKey);
      // console.log("Account deployed:", txHash);

    } catch (error) {
      console.error("Failed to create account:", error);
      alert("Failed to create account. Please try again.");
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
          <div
            className={`w-[100%] py-[0.7rem] px-[1rem] Text__medium Button__primary ${isCreatingAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={isCreatingAccount ? undefined : clearAvailableKeys}
          >
            <p className="Text__large">
              {isCreatingAccount
                ? "Please wait..."
                : "Delete Accounts"}
            </p>
          </div>
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
            <p className="Text__medium pr-[0.5rem] truncate w-[21rem] text-right">
              {username}
            </p>
          </div>
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
        <div className="flex flex-row align-center justify-center w-full pt-[2rem]">
          <button
            className="w-[70%] py-[0.7rem] px-[1rem] Text__medium Button__primary"
            onClick={() => disconnect()}
          >
            Logout
          </button>
        </div>
      )}
    </BasicTab>
  );
};
