"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import {
  Account,
  RpcProvider,
  CallData,
  ec,
  hash,
  Call,
  constants,
  InvokeFunctionResponse,
} from "starknet";
import { getNetworkConfig, STORAGE_KEYS, CANVAS_CONTRACT_ADDRESS } from "@/config/ztarknet";

interface ZtarknetConnectorContextType {
  account: Account | null;
  address: string | null;
  isConnected: boolean;
  provider: RpcProvider | null;

  // Account management
  createAccount: () => Promise<{ address: string; privateKey: string }>;
  connectStorageAccount: (privateKey: string) => Promise<void>;
  getAvailableKeys: () => string[];
  clearAvailableKeys: () => void;
  disconnectAccount: () => void;

  // Contract interaction
  invokeContract: (call: Call) => Promise<InvokeFunctionResponse>;
  invokeContractCalls: (calls: Call[]) => Promise<InvokeFunctionResponse>;

  // Utility
  deployAccount: (privateKey: string) => Promise<string>;
}

const ZtarknetConnectorContext = createContext<ZtarknetConnectorContextType | undefined>(
  undefined
);

export const useZtarknetConnector = () => {
  const context = useContext(ZtarknetConnectorContext);
  if (!context) {
    throw new Error("useZtarknetConnector must be used within ZtarknetConnectorProvider");
  }
  return context;
};

export const ZtarknetConnectorProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<RpcProvider | null>(null);

  // Initialize provider
  const initializeProvider = useCallback(() => {
    const config = getNetworkConfig();
    const newProvider = new RpcProvider({
      nodeUrl: config.rpcUrl,
      chainId: config.chainId as constants.StarknetChainId,
      blockIdentifier: "latest",
    });
    setProvider(newProvider);
    return newProvider;
  }, []);

  // Generate a random private key
  const generatePrivateKey = (): string => {
    const randomBytes = new Uint8Array(31);
    if (typeof window !== "undefined" && window.crypto) {
      window.crypto.getRandomValues(randomBytes);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < randomBytes.length; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }

    const hex = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return "0x" + hex;
  };

  // Calculate account address from private key
  const calculateAccountAddress = (privateKey: string): string => {
    const config = getNetworkConfig();
    const publicKey = ec.starkCurve.getStarkKey(privateKey);

    const constructorCalldata = CallData.compile({
      publicKey: publicKey,
    });

    const accountAddress = hash.calculateContractAddressFromHash(
      publicKey, // salt
      config.accountClassHash,
      constructorCalldata,
      0 // deployer address
    );

    return accountAddress;
  };

  // Store private key in local storage
  const storePrivateKey = (privateKey: string, address: string) => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNT_PRIVATE_KEY, privateKey);
      localStorage.setItem(STORAGE_KEYS.ACCOUNT_ADDRESS, address);

      // Update available keys list
      const availableKeys = getAvailableKeys();
      if (!availableKeys.includes(privateKey)) {
        const updatedKeys = [...availableKeys, privateKey];
        localStorage.setItem(STORAGE_KEYS.AVAILABLE_KEYS, JSON.stringify(updatedKeys));
      }
    } catch (error) {
      console.error("Failed to store private key:", error);
      throw new Error("Failed to securely store account credentials");
    }
  };

  // Get available keys from storage
  const getAvailableKeys = useCallback((): string[] => {
    try {
      const storedKeys = localStorage.getItem(STORAGE_KEYS.AVAILABLE_KEYS);
      if (storedKeys) {
        return JSON.parse(storedKeys);
      }
      return [];
    } catch (error) {
      console.error("Failed to retrieve available keys:", error);
      return [];
    }
  }, []);

  const clearAvailableKeys = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.AVAILABLE_KEYS);
    } catch (error) {
      console.error("Failed to clear available keys:", error);
    }
  }, []);

  // Create a new account
  const createAccount = useCallback(async (): Promise<{ address: string; privateKey: string }> => {
    try {
      const config = getNetworkConfig();
      const privateKey = generatePrivateKey();
      const accountAddress = calculateAccountAddress(privateKey);

      // Store the account credentials
      storePrivateKey(privateKey, accountAddress);

      console.log("Account created:", {
        address: accountAddress,
        privateKey: privateKey.substring(0, 10) + "...",
      });

      return { address: accountAddress, privateKey };
    } catch (error) {
      console.error("Failed to create account:", error);
      throw error;
    }
  }, []);

  // Deploy an account on-chain
  const deployAccount = useCallback(
    async (privateKey: string): Promise<string> => {
      try {
        const config = getNetworkConfig();
        const currentProvider = provider || initializeProvider();

        const publicKey = ec.starkCurve.getStarkKey(privateKey);
        const accountAddress = calculateAccountAddress(privateKey);

        const accountInstance = new Account({
          provider: currentProvider,
          address: accountAddress,
          signer: privateKey,
          cairoVersion: "1",
          transactionVersion: '0x3'
        });

        const constructorCalldata = CallData.compile({
          publicKey: publicKey,
        });

        console.log("Deploying account...", accountAddress);

        const deployResponse = await accountInstance.deployAccount({
          classHash: config.accountClassHash,
          constructorCalldata,
          addressSalt: publicKey,
        });

        console.log("Account deployment transaction:", deployResponse.transaction_hash);

        // Wait for deployment confirmation
        await currentProvider.waitForTransaction(deployResponse.transaction_hash, {
          retryInterval: 100,
        });

        console.log("Account deployed successfully!");
        return deployResponse.transaction_hash;
      } catch (error) {
        console.error("Failed to deploy account:", error);
        throw error;
      }
    },
    [provider, initializeProvider]
  );

  // Connect to an existing account from storage
  const connectStorageAccount = useCallback(
    async (privateKey: string): Promise<void> => {
      try {
        const config = getNetworkConfig();
        const currentProvider = provider || initializeProvider();

        const accountAddress = calculateAccountAddress(privateKey);

        const accountInstance = new Account({
          provider: currentProvider,
          address: accountAddress,
          signer: privateKey,
          cairoVersion: "1",
          transactionVersion: '0x3'
        });

        setAccount(accountInstance);
        setAddress(accountAddress);
        setProvider(currentProvider);

        // Store/update in local storage
        storePrivateKey(privateKey, accountAddress);

        console.log("Connected to account:", accountAddress);
      } catch (error) {
        console.error("Failed to connect to storage account:", error);
        throw error;
      }
    },
    [provider, initializeProvider]
  );

  // Disconnect account
  const disconnectAccount = useCallback(() => {
    setAccount(null);
    setAddress(null);
    console.log("Account disconnected");
  }, []);

  // Invoke a single contract call
  const invokeContract = useCallback(
    async (call: Call): Promise<InvokeFunctionResponse> => {
      if (!account) {
        throw new Error("No account connected");
      }

      try {
        console.log("Invoking contract:", call);

        // Get nonce explicitly
        const nonce = await account.getNonce("pre_confirmed");

        const response = await account.execute(call, {
          nonce,
        });

        console.log("Transaction hash:", response.transaction_hash);

        // Wait for transaction confirmation
        if (provider) {
          await provider.waitForTransaction(response.transaction_hash, {
            retryInterval: 100,
          });
        }

        return response;
      } catch (error) {
        console.error("Failed to invoke contract:", error);
        throw error;
      }
    },
    [account, provider]
  );

  // Invoke multiple contract calls
  const invokeContractCalls = useCallback(
    async (calls: Call[]): Promise<InvokeFunctionResponse> => {
      if (!account) {
        throw new Error("No account connected");
      }

      try {
        console.log("Invoking multiple contract calls:", calls.length);

        // Get nonce explicitly
        const nonce = await account.getNonce("pre_confirmed");

        const response = await account.execute(calls, {
          nonce,
        });

        console.log("Transaction hash:", response.transaction_hash);

        // Wait for transaction confirmation
        if (provider) {
          await provider.waitForTransaction(response.transaction_hash, {
            retryInterval: 100,
          });
        }

        return response;
      } catch (error) {
        console.error("Failed to invoke contract calls:", error);
        throw error;
      }
    },
    [account, provider]
  );

  const value: ZtarknetConnectorContextType = {
    account,
    address,
    isConnected: !!account && !!address,
    provider,
    createAccount,
    connectStorageAccount,
    getAvailableKeys,
    clearAvailableKeys,
    disconnectAccount,
    invokeContract,
    invokeContractCalls,
    deployAccount,
  };

  return (
    <ZtarknetConnectorContext.Provider value={value}>
      {children}
    </ZtarknetConnectorContext.Provider>
  );
};
