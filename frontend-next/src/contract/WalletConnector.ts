import { useZtarknetConnector } from "@/context/ZtarknetConnector";
import { Call } from "starknet";

export const useAccount = () => {
  const { account, address, isConnected } = useZtarknetConnector();

  if (isConnected && account && address) {
    return {
      chain: "Ztarknet",
      account: {
        execute: async (calls: Call | Call[]) => {
          const callsArray = Array.isArray(calls) ? calls : [calls];

          // Use invokeContractCalls for multiple calls, invokeContract for single call
          if (callsArray.length === 1) {
            const response = await account.execute(callsArray[0]);
            return { transaction_hash: response.transaction_hash };
          } else {
            const response = await account.execute(callsArray);
            return { transaction_hash: response.transaction_hash };
          }
        },
      },
      address,
    };
  }

  return {};
};

export const useZtarknetConnect = () => {
  const {
    connectStorageAccount,
    storeKeyAndConnect,
    getAvailableKeys,
    getPrivateKey,
    storePrivateKey,
    clearPrivateKey,
    clearPrivateKeys,
    setFundingCallback,
    getBalance
  } = useZtarknetConnector();

  return {
    connect: connectStorageAccount,
    storeKeyAndConnect,
    getAvailableKeys,
    getPrivateKey,
    storePrivateKey,
    clearPrivateKey,
    clearPrivateKeys,
    setFundingCallback,
    getBalance
  };
};

export const useZtarknetCreate = () => {
  const { createAccount } = useZtarknetConnector();

  return {
    createAccount,
  };
};

export const useDisconnect = () => {
  const { disconnectAccount } = useZtarknetConnector();

  return {
    disconnect: disconnectAccount,
  };
};

// Legacy export for backward compatibility
export const useSnConnect = () => {
  return {
    connect: () => {
      console.log("Legacy connect - use useZtarknetConnect instead");
    },
    connector: null,
    connectors: [],
  };
};
