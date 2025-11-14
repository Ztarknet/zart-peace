import { constants } from "starknet";

export interface ZtarknetConfig {
  rpcUrl: string;
  chainId: string;
  accountClassHash: string;
}

export const ZTARKNET_NETWORKS = {
  ZTARKNET_TESTNET: {
    name: "Ztarknet Testnet",
    chainId: "0x534e5f5345504f4c4941",
    rpcUrl: "https://ztarknet-madara.d.karnot.xyz",
    accountClassHash: process.env.NEXT_PUBLIC_ZTARKNET_ACCOUNT_CLASS_HASH ||
      "0x01484c93b9d6cf61614d698ed069b3c6992c32549194fc3465258c2194734189"
  },
  ZTARKNET_MADARA: {
    name: "Ztarknet Madara Local",
    chainId: "0x5a5441524b4e4554",
    rpcUrl: "http://localhost:9944",
    accountClassHash: process.env.NEXT_PUBLIC_ZTARKNET_ACCOUNT_CLASS_HASH ||
      "0xe2eb8f5672af4e6a4e8a8f1b44989685e668489b0a25437733756c5a34a1d6"
  }
} as const;

export type ZtarknetNetworkType = keyof typeof ZTARKNET_NETWORKS;

export const getCurrentNetwork = (): ZtarknetNetworkType => {
  const network = process.env.NEXT_PUBLIC_ZTARKNET_NETWORK as ZtarknetNetworkType;
  return network && network in ZTARKNET_NETWORKS ? network : "ZTARKNET_TESTNET";
};

export const getNetworkConfig = (): ZtarknetConfig => {
  const network = getCurrentNetwork();
  return ZTARKNET_NETWORKS[network];
};

export const CANVAS_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CANVAS_CONTRACT_ADDRESS ||
  "0x011195b78f3765b1b8cfe841363e60f2335adf67af2443364d4b15cf8dff60ac";

// Storage keys for local storage
export const STORAGE_KEYS = {
  ACCOUNT_ADDRESS: "ztarknet_account_address",
  ACCOUNT_PRIVATE_KEY: "ztarknet_account_private_key",
  AVAILABLE_KEYS: "ztarknet_available_keys"
};
