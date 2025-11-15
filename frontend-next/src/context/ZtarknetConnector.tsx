"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  Account,
  RpcProvider,
  CallData,
  ec,
  hash,
  Call,
  constants,
  InvokeFunctionResponse,
  Contract,
  uint256,
} from "starknet";
import { getNetworkConfig, getCurrentNetwork, STORAGE_KEYS, CANVAS_CONTRACT_ADDRESS } from "@/config/ztarknet";

interface ZtarknetConnectorContextType {
  account: Account | null;
  address: string | null;
  isConnected: boolean;
  provider: RpcProvider | null;

  // Account management
  createAccount: () => Promise<{ address: string; privateKey: string }>;
  connectStorageAccount: (privateKey: string) => Promise<void>;
  storeKeyAndConnect: (privateKey: string) => Promise<void>;
  mintFunds: (toAddress: string, amount: string) => Promise<void>;
  setFundingCallback: (callback: ((address: string) => Promise<void>) | null) => void;

  // Storage management
  getAvailableKeys: () => string[];
  getPrivateKey: (keyId: string) => string | null;
  storePrivateKey: (privateKey: string, address: string) => string;
  clearPrivateKey: (keyId: string) => void;
  clearPrivateKeys: () => void;
  disconnectAccount: () => void;

  // Contract interaction
  invokeContract: (call: Call) => Promise<InvokeFunctionResponse>;
  invokeContractCalls: (calls: Call[]) => Promise<InvokeFunctionResponse>;

  // Utility
  deployAccount: (privateKey: string, accountAddress: string) => Promise<string>;
  getBalance: (accountAddress: string, tokenAddress?: string) => Promise<bigint>;
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
  const fundingCallbackRef = React.useRef<((address: string) => Promise<void>) | null>(null);

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
  function generatePrivateKey(): string {
    // Generate a valid Stark private key
    // The key must be in range: 1 <= n < CURVE_ORDER
    // We generate 252 bits (31.5 bytes) to stay safely within the curve order
    const randomBytes = new Uint8Array(31);
    crypto.getRandomValues(randomBytes);
  
    // Convert to hex string and ensure it starts with 0x
    let hexString = '0x' + Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  
    return hexString;
  }

  // Calculate account address from private key
  const calculateAccountAddress = (privateKey: string, classHash: string): string => {
    // Get the Stark public key from private key
    const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
  
    // Constructor calldata is just the public key for this account type
    const constructorCalldata = [starkKeyPub];
  
    // Calculate the contract address
    const contractAddress = hash.calculateContractAddressFromHash(
      starkKeyPub,
      classHash,
      constructorCalldata,
      0
    );
  
    return contractAddress;
  }

  // ==================== Storage Management Functions ====================
  // These functions follow the secure storage pattern from StarknetConnector
  // Private keys are stored individually, and only key IDs are stored in the available keys list

  /**
   * Generate a composite key identifier for storage
   * Format: {network}.{appName}.{accountClassName}.{address}
   */
  const generateKeyId = (address: string): string => {
    const network = getCurrentNetwork();
    return STORAGE_KEYS.PRIVATE_KEY(network, address);
  };

  /**
   * Store a private key securely and return its key ID
   * @param privateKey The private key to store
   * @param address The account address
   * @returns The composite key ID
   */
  const storePrivateKey = useCallback((privateKey: string, address: string): string => {
    try {
      const network = getCurrentNetwork();
      const keyId = generateKeyId(address);

      // Store the private key using the composite key ID
      localStorage.setItem(keyId, privateKey);

      // Update the available keys list (storing key IDs, NOT private keys)
      const availableKeys = getAvailableKeys();
      if (!availableKeys.includes(keyId)) {
        const updatedKeys = [...availableKeys, keyId];
        localStorage.setItem(STORAGE_KEYS.AVAILABLE_KEYS(network), JSON.stringify(updatedKeys));
      }

      // Also store as current active account
      localStorage.setItem(STORAGE_KEYS.ACCOUNT_PRIVATE_KEY, privateKey);
      localStorage.setItem(STORAGE_KEYS.ACCOUNT_ADDRESS, address);

      console.log(`Private key stored with ID: ${keyId}`);
      return keyId;
    } catch (error) {
      console.error("Failed to store private key:", error);
      throw new Error("Failed to securely store account credentials");
    }
  }, []);

  /**
   * Retrieve a private key by its key ID
   * @param keyId The composite key ID
   * @returns The private key or null if not found
   */
  const getPrivateKey = useCallback((keyId: string): string | null => {
    try {
      const privateKey = localStorage.getItem(keyId);
      return privateKey;
    } catch (error) {
      console.error("Failed to retrieve private key:", error);
      return null;
    }
  }, []);

  /**
   * Get list of available key IDs (NOT the keys themselves)
   * @returns Array of composite key IDs
   */
  const getAvailableKeys = useCallback((): string[] => {
    try {
      const network = getCurrentNetwork();
      const storedKeys = localStorage.getItem(STORAGE_KEYS.AVAILABLE_KEYS(network));
      if (storedKeys) {
        return JSON.parse(storedKeys);
      }
      return [];
    } catch (error) {
      console.error("Failed to retrieve available keys:", error);
      return [];
    }
  }, []);

  /**
   * Clear a specific private key from storage
   * @param keyId The composite key ID to remove
   */
  const clearPrivateKey = useCallback((keyId: string): void => {
    try {
      const network = getCurrentNetwork();

      // Remove the private key
      localStorage.removeItem(keyId);

      // Remove from available keys list
      const availableKeys = getAvailableKeys();
      const updatedKeys = availableKeys.filter(k => k !== keyId);
      localStorage.setItem(STORAGE_KEYS.AVAILABLE_KEYS(network), JSON.stringify(updatedKeys));

      console.log(`Private key removed: ${keyId}`);
    } catch (error) {
      console.error("Failed to clear private key:", error);
    }
  }, []);

  /**
   * Clear all private keys for the current app
   */
  const clearPrivateKeys = useCallback((): void => {
    try {
      const network = getCurrentNetwork();
      const availableKeys = getAvailableKeys();

      // Remove each private key from storage
      availableKeys.forEach(keyId => {
        localStorage.removeItem(keyId);
      });

      // Clear the available keys list
      localStorage.removeItem(STORAGE_KEYS.AVAILABLE_KEYS(network));

      // Clear current active account
      localStorage.removeItem(STORAGE_KEYS.ACCOUNT_PRIVATE_KEY);
      localStorage.removeItem(STORAGE_KEYS.ACCOUNT_ADDRESS);

      console.log("All private keys cleared");
    } catch (error) {
      console.error("Failed to clear private keys:", error);
    }
  }, []);

  // ERC20 ABI for balanceOf
  const ERC20_ABI = [
    {
      name: "balanceOf",
      type: "function",
      inputs: [
        {
          name: "account",
          type: "core::starknet::contract_address::ContractAddress",
        },
      ],
      outputs: [{ type: "core::integer::u256" }],
      state_mutability: "view",
    },
  ];

  const getBalance = useCallback(async (accountAddress: string, tokenAddress?: string): Promise<bigint> => {
    try {
      const currentProvider = provider || initializeProvider();
      const feeToken = tokenAddress || process.env.NEXT_PUBLIC_FEE_TOKEN || "0x1ad102b4c4b3e40a51b6fb8a446275d600555bd63a95cdceed3e5cef8a6bc1d";

      const tokenContract = new Contract({
        abi: ERC20_ABI,
        address: feeToken,
        providerOrAccount: currentProvider,
      });

      const balance = await tokenContract.balanceOf(accountAddress);
      const balanceValue = uint256.uint256ToBN(balance);

      return balanceValue;
    } catch (error) {
      console.error("Failed to get balance:", error);
      return BigInt(0);
    }
  }, [provider, initializeProvider]);

  const setFundingCallback = useCallback((callback: ((address: string) => Promise<void>) | null) => {
    fundingCallbackRef.current = callback;
  }, []);

  const mintFunds = useCallback(async (toAddress: string, amount: string): Promise<void> => {
    try {
      const currentProvider = provider || initializeProvider();
      const config = getNetworkConfig();

      // Use custom funding callback if available (e.g., modal), otherwise use window.prompt
      if (fundingCallbackRef.current) {
        console.log(`Opening funding modal for address: ${toAddress}`);
        await fundingCallbackRef.current(toAddress);
        console.log("Funding completed via modal");
      } else {
        // Fallback: Manual funding with window.prompt
        console.log(`Please send funds to this address to continue: ${toAddress}`);

        let userInput = "";
        while (userInput !== "Done") {
          userInput = window.prompt(
            `Please send funds to this address:\n\n${toAddress}\n\nType "Done" when you have completed the transfer:`
          ) || "";

          if (userInput !== "Done" && userInput !== "") {
            alert('Please type "Done" exactly (case-sensitive) to continue.');
          }
        }

        console.log("Minting completed");
      }
    } catch (error) {
      console.error("Failed to mint funds:", error);
      throw error;
    }
  }, [provider, initializeProvider]);

  // Create a new account
  const createAccount = useCallback(async (): Promise<{ address: string; privateKey: string }> => {
    try {
      const config = getNetworkConfig();
      const privateKey = generatePrivateKey();
      const accountAddress = calculateAccountAddress(privateKey, config.accountClassHash);
      console.log("Creating new account:", accountAddress);

      const fundingAmount = "100000000000000000"; // 0.1 tokens (10^17)
      await mintFunds(accountAddress, fundingAmount);
      console.log("Account funded, proceeding to deploy...");

      await deployAccount(privateKey, accountAddress);

      // Store the account credentials
      storePrivateKey(privateKey, accountAddress);

      console.log("Account deployed:", {
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
    async (privateKey: string, accountAddress: string): Promise<string> => {
      try {
        const config = getNetworkConfig();
        const currentProvider = provider || initializeProvider();

        const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
        const constructorCalldata = [starkKeyPub];

        const accountInstance = new Account({
          provider: currentProvider,
          address: accountAddress,
          signer: privateKey,
          cairoVersion: "1",
          transactionVersion: '0x3'
        });

        console.log("Deploying account...", accountAddress);

        const deployResponse = await accountInstance.deployAccount({
          classHash: config.accountClassHash,
          constructorCalldata,
          addressSalt: starkKeyPub,
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

        const accountAddress = calculateAccountAddress(privateKey, config.accountClassHash);

        const accountInstance = new Account({
          provider: currentProvider,
          address: accountAddress,
          signer: privateKey,
          cairoVersion: "1",
          transactionVersion: '0x3'
        });

        setAccount(accountInstance);
        // address = accountAddress -> strip leading '0x' and pad to 64 chars -> add '0x' prefix back
        const paddedAddress = '0x' + accountAddress.slice(2).padStart(64, '0');
        setAddress(paddedAddress);
        setProvider(currentProvider);

        console.log("Connected to account:", accountAddress);
      } catch (error) {
        console.error("Failed to connect to storage account:", error);
        throw error;
      }
    },
    [provider, initializeProvider]
  );

  /**
   * Store a private key and immediately connect to it
   * This combines storePrivateKey and connectStorageAccount
   * @param privateKey The private key to store and connect
   */
  const storeKeyAndConnect = useCallback(
    async (privateKey: string): Promise<void> => {
      try {
        const config = getNetworkConfig();
        const accountAddress = calculateAccountAddress(privateKey, config.accountClassHash);

        // Store the key first
        storePrivateKey(privateKey, accountAddress);

        // Then connect to it
        await connectStorageAccount(privateKey);

        console.log("Key stored and connected:", accountAddress);
      } catch (error) {
        console.error("Failed to store key and connect:", error);
        throw error;
      }
    },
    [connectStorageAccount, storePrivateKey]
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

  // Auto-connect on app load if there's an existing account
  useEffect(() => {
    const autoConnect = async () => {
      if (account) return; // Already connected

      const availableKeyIds = getAvailableKeys();
      if (availableKeyIds && availableKeyIds.length > 0) {
        try {
          // Get the private key from the first key ID
          const privateKey = getPrivateKey(availableKeyIds[0]);
          if (privateKey) {
            await connectStorageAccount(privateKey);
            console.log("Auto-connected to existing account on app load");
          }
        } catch (error) {
          console.error("Failed to auto-connect on app load:", error);
        }
      }
    };

    autoConnect();
  }, []); // Empty dependency array means this runs once on mount

  const value: ZtarknetConnectorContextType = {
    account,
    address,
    isConnected: !!account && !!address,
    provider,
    mintFunds,
    createAccount,
    connectStorageAccount,
    storeKeyAndConnect,
    setFundingCallback,
    getAvailableKeys,
    getPrivateKey,
    storePrivateKey,
    clearPrivateKey,
    clearPrivateKeys,
    disconnectAccount,
    invokeContract,
    invokeContractCalls,
    deployAccount,
    getBalance,
  };

  return (
    <ZtarknetConnectorContext.Provider value={value}>
      {children}
    </ZtarknetConnectorContext.Provider>
  );
};
