import { useState, useEffect } from "react";
import { useAccount } from '@/contract/WalletConnector';
import { BasicTab } from "./basic";
import { getPixelInfo } from "../../api/canvas";

// TODO: ZTARKNET: Replace lookupAddresses with Ztarknet username lookup
// import { lookupAddresses } from '@cartridge/controller';

export const PixelInfoTab = (props: any) => {
  const [ownerAddress, setOwnerAddress] = useState<string>();
  const [ownerUsername, setOwnerUsername] = useState<string>();
  useEffect(() => {
    const getOwnerUsername = async () => {
      if (!ownerAddress) return;
      const zeroAddress = "0x0000000000000000000000000000000000000000000000000000000000000000";
      if (ownerAddress === zeroAddress) {
        setOwnerUsername("No one!");
        return;
      }

      // TODO: ZTARKNET: Replace with Ztarknet username lookup
      // const username = await ztarknetSDK.lookupUsername(ownerAddress);
      // if (username) {
      //   setOwnerUsername(username);
      // } else {
      //   setOwnerUsername(`${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}`);
      // }

      // Temporary: just show shortened address
      setOwnerUsername(`${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}`);
    }
    getOwnerUsername();
  }, [ownerAddress]);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  const [hasGotOwnerAddress, setHasGotOwnerAddress] = useState<boolean>(false);
  useEffect(() => {
    setHasGotOwnerAddress(false);
    setOwnerUsername(ownerAddress);
  }, [props.worldId, props.x, props.y]);
  useEffect(() => {
    const getOwnerAddress = async () => {
      if (props.worldId === undefined || !props.x || !props.y || !props.width) return;
      try {
        const pixelInfo = await getPixelInfo(props.worldId, props.y * props.width + props.x);
        // TODO: Remove zero padding?
        setOwnerAddress(`${pixelInfo}`);
      } catch (e) {
        console.error(e);
      }
    }
    // Frontrun getOwnerAddress if we haven't checked the owner address in the last second
    if (hasGotOwnerAddress) return;
    if (Date.now() - lastCheckTime > 1000) {
      getOwnerAddress();
      setHasGotOwnerAddress(true);
      setLastCheckTime(Date.now());
    }
    // Call getOwnerAddress after one second
    const interval = setInterval(() => {
      if (hasGotOwnerAddress) return;
      getOwnerAddress();
      setHasGotOwnerAddress(true);
      setLastCheckTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [hasGotOwnerAddress, props.worldId, props.x, props.y, props.width]);

  return (
    <BasicTab title="Pixel Info" {...props} style={{ marginBottom: "0.5rem" }} onClose={props.clearPixelSelection}>
      <div className="flex flex-col w-full mt-[1rem]"> 
        <div className="px-[0.5rem] mx-[0.5rem] flex flex-row align-center justify-between">
          <p className="Text__medium pr-[1rem]">World&nbsp;&nbsp;&nbsp;&nbsp;:</p>
          <p className="Text__medium pr-[0.5rem] text-right truncate">
            {props.worldName}
          </p>
        </div>
        <div className="px-[0.5rem] mx-[0.5rem] mt-[0.5rem] flex flex-row align-center justify-between">
          <p className="Text__medium pr-[1rem]">Position&nbsp;:</p>
          <p className="Text__medium pr-[0.5rem] text-right">
            ({props.x}, {props.y})
          </p>
        </div>
        <div className="px-[0.5rem] mx-[0.5rem] my-[0.5rem] flex flex-row align-center justify-between">
          <p className="Text__medium pr-[1rem]">Owner&nbsp;&nbsp;&nbsp;&nbsp;:</p>
          <p className="Text__medium pr-[0.5rem] truncate w-[21rem] text-right">{ownerUsername}</p>
        </div>
      </div>
    </BasicTab>
  );
}
