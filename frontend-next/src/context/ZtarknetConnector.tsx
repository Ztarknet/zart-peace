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
  username: string | null;

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

  // Username management
  getUsernameForAddress: (userAddress: string) => Promise<string | null>;
  getUsernamesForAddresses: (userAddresses: string[]) => Promise<Map<string, string>>;
  claimUsername: (username: string) => Promise<string | null>;
  isUsernameClaimed: (username: string) => Promise<boolean>;
  refreshUsername: () => Promise<void>;

  // Utility
  deployAccount: (privateKey: string, accountAddress: string) => Promise<string>;
  getBalance: (accountAddress: string, tokenAddress?: string) => Promise<bigint>;

  // Canvas contract calls
  placePixel: (worldId: number, position: number, colorId: number, now: number) => Promise<string | null>;
  placePixels: (worldId: number, pixels: Array<{ position: number; colorId: number }>, now: number) => Promise<string | null>;
  createCanvas: (host: string, name: string, unique_name: string, width: number, height: number, pixels_per_time: number, timer: number, color_palette: string[], start_time: number, end_time: number) => Promise<string | null>;
  addStencil: (worldId: number, hash: string, width: number, height: number, position: number) => Promise<string | null>;
  favoriteStencil: (worldId: number, stencilId: number) => Promise<string | null>;
  unfavoriteStencil: (worldId: number, stencilId: number) => Promise<string | null>;
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
  const [username, setUsername] = useState<string | null>(null);
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
    const hexString = '0x' + Array.from(randomBytes)
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

  // Canvas contract ABI for username functions
  const USERNAME_ABI = [
    {
      name: "get_username",
      type: "function",
      inputs: [
        {
          name: "user",
          type: "core::starknet::contract_address::ContractAddress",
        },
      ],
      outputs: [{ type: "core::felt252" }],
      state_mutability: "view",
    },
    {
      name: "get_usernames",
      type: "function",
      inputs: [
        {
          name: "users",
          type: "core::array::Span::<core::starknet::contract_address::ContractAddress>",
        },
      ],
      outputs: [{ type: "core::array::Span::<core::felt252>" }],
      state_mutability: "view",
    },
    {
      name: "claim_username",
      type: "function",
      inputs: [
        {
          name: "username",
          type: "core::felt252",
        },
      ],
      outputs: [],
      state_mutability: "external",
    },
    {
      name: "is_username_claimed",
      type: "function",
      inputs: [
        {
          name: "username",
          type: "core::felt252",
        },
      ],
      outputs: [{ type: "core::bool" }],
      state_mutability: "view",
    },
  ];

  // Helper function to convert felt252 to string
  const felt252ToString = (felt: bigint): string => {
    if (!felt || felt === BigInt(0)) return "";

    let str = "";
    let num = felt;
    while (num > BigInt(0)) {
      const char = Number(num % BigInt(256));
      if (char === 0) break;
      str = String.fromCharCode(char) + str;
      num = num / BigInt(256);
    }
    return str;
  };

  // Helper function to convert string to felt252
  const stringToFelt252 = (str: string): string => {
    if (!str) return "0x0";

    let felt = BigInt(0);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      felt = felt * BigInt(256) + BigInt(char);
    }
    return "0x" + felt.toString(16);
  };

  const getUsernameForAddress = useCallback(async (userAddress: string): Promise<string | null> => {
    try {
      const currentProvider = provider || initializeProvider();

      const canvasContract = new Contract({
        abi: USERNAME_ABI,
        address: CANVAS_CONTRACT_ADDRESS,
        providerOrAccount: currentProvider,
      });

      const usernameFelt = await canvasContract.get_username(userAddress);
      const usernameStr = felt252ToString(BigInt(usernameFelt));

      return usernameStr || null;
    } catch (error) {
      console.error("Failed to get username:", error);
      return null;
    }
  }, [provider, initializeProvider]);

  const getUsernamesForAddresses = useCallback(async (userAddresses: string[]): Promise<Map<string, string>> => {
    const usernameMap = new Map<string, string>();

    if (userAddresses.length === 0) {
      return usernameMap;
    }

    try {
      const currentProvider = provider || initializeProvider();

      const canvasContract = new Contract({
        abi: USERNAME_ABI,
        address: CANVAS_CONTRACT_ADDRESS,
        providerOrAccount: currentProvider,
      });

      const usernamesFelt = await canvasContract.get_usernames(userAddresses);

      // Convert felt252 array to strings and create map
      for (let i = 0; i < userAddresses.length; i++) {
        const usernameFelt = usernamesFelt[i];
        const usernameStr = felt252ToString(BigInt(usernameFelt));
        if (usernameStr) {
          usernameMap.set(userAddresses[i], usernameStr);
        }
      }

      return usernameMap;
    } catch (error) {
      console.error("Failed to get usernames:", error);
      return usernameMap;
    }
  }, [provider, initializeProvider]);

  const claimUsername = useCallback(async (usernameStr: string): Promise<string | null> => {
    if (!account) {
      throw new Error("No account connected");
    }

    try {
      const usernameFelt = stringToFelt252(usernameStr);

      console.log("Claiming username:", usernameStr, "as felt:", usernameFelt);

      const response = await account.execute([
        {
          contractAddress: CANVAS_CONTRACT_ADDRESS,
          entrypoint: "claim_username",
          calldata: [usernameFelt],
        },
      ]);

      console.log("Username claim transaction hash:", response.transaction_hash);

      // Wait for transaction confirmation
      if (provider) {
        await provider.waitForTransaction(response.transaction_hash, {
          retryInterval: 100,
        });
      }

      // Update local username state
      setUsername(usernameStr);

      return response.transaction_hash;
    } catch (error) {
      console.error("Failed to claim username:", error);
      return null;
    }
  }, [account, provider]);

  const isUsernameClaimed = useCallback(async (usernameStr: string): Promise<boolean> => {
    try {
      const currentProvider = provider || initializeProvider();
      const usernameFelt = stringToFelt252(usernameStr);

      const canvasContract = new Contract({
        abi: USERNAME_ABI,
        address: CANVAS_CONTRACT_ADDRESS,
        providerOrAccount: currentProvider,
      });

      const isClaimed = await canvasContract.is_username_claimed(usernameFelt);

      return Boolean(isClaimed);
    } catch (error) {
      console.error("Failed to check username:", error);
      return false;
    }
  }, [provider, initializeProvider]);

  const refreshUsername = useCallback(async (): Promise<void> => {
    if (!address) {
      setUsername(null);
      return;
    }

    try {
      const usernameStr = await getUsernameForAddress(address);
      setUsername(usernameStr);
    } catch (error) {
      console.error("Failed to refresh username:", error);
      setUsername(null);
    }
  }, [address, getUsernameForAddress]);

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

        if (!provider) {
          throw new Error("Provider not initialized");
        }

        const nonce = await provider.getNonceForAddress(account.address, "pre_confirmed");
        // nonce ? (BigInt(nonce) + BigInt(1)).toString() : await provider.getNonceForAddress(account.address, "pre_confirmed");
        console.log("Using nonce:", nonce);
        const response = await account.execute(call, {
          nonce: nonce,
          skipValidate: true,
          blockIdentifier: "pre_confirmed",
        });

        console.log("Transaction hash:", response.transaction_hash);

        // Wait for transaction confirmation
        await provider.waitForTransaction(response.transaction_hash, {
          retryInterval: 100,
        });

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

        if (!provider) {
          throw new Error("Provider not initialized");
        }

        const nonce = await provider.getNonceForAddress(account.address, "pre_confirmed");
        // nonce ? (BigInt(nonce) + BigInt(1)).toString() : await provider.getNonceForAddress(account.address, "pre_confirmed");
        console.log("Using nonce:", nonce);
        const response = await account.execute(calls, {
          nonce: nonce,
          skipValidate: true,
          blockIdentifier: "pre_confirmed",
        });

        console.log("Transaction hash:", response.transaction_hash);

        // Wait for transaction confirmation
        await provider.waitForTransaction(response.transaction_hash, {
          retryInterval: 100,
        });

        return response;
      } catch (error) {
        console.error("Failed to invoke contract calls:", error);
        throw error;
      }
    },
    [account, provider]
  );

  // ==================== Canvas Contract Calls ====================

  const placePixel = useCallback(
    async (worldId: number, position: number, colorId: number, now: number): Promise<string | null> => {
      if (!account) {
        console.error("Account not connected");
        return null;
      }

      try {
        const calldata = [worldId, position, colorId, now];
        console.log("Placing pixel:", { worldId, position, colorId, now });

        const response = await invokeContract({
          contractAddress: CANVAS_CONTRACT_ADDRESS,
          entrypoint: "place_pixel",
          calldata,
        });

        console.log("Pixel placed, tx hash:", response.transaction_hash);
        return response.transaction_hash;
      } catch (error) {
        console.error("Failed to place pixel:", error);
        return null;
      }
    },
    [account, invokeContract]
  );

  const placePixels = useCallback(
    async (worldId: number, pixels: Array<{ position: number; colorId: number }>, now: number): Promise<string | null> => {
      if (!account) {
        console.error("Account not connected");
        return null;
      }

      try {
        const pixel_positions = pixels.map(p => p.position);
        const pixel_colors = pixels.map(p => p.colorId);
        const calldata = [worldId, pixels.length, ...pixel_positions, pixels.length, ...pixel_colors, now];

        console.log("Placing pixels:", { worldId, count: pixels.length, now });

        const response = await invokeContract({
          contractAddress: CANVAS_CONTRACT_ADDRESS,
          entrypoint: "place_pixels",
          calldata,
        });

        console.log("Pixels placed, tx hash:", response.transaction_hash);
        return response.transaction_hash;
      } catch (error) {
        console.error("Failed to place pixels:", error);
        return null;
      }
    },
    [account, invokeContract]
  );

  const createCanvas = useCallback(
    async (
      host: string,
      name: string,
      unique_name: string,
      width: number,
      height: number,
      pixels_per_time: number,
      timer: number,
      color_palette: string[],
      start_time: number,
      end_time: number
    ): Promise<string | null> => {
      if (!account) {
        console.error("Account not connected");
        return null;
      }

      try {
        const calldata = [host, name, unique_name, width, height, pixels_per_time, timer, color_palette.length, ...color_palette, start_time, end_time];

        console.log("Creating canvas:", { name, unique_name, width, height });

        const response = await invokeContract({
          contractAddress: CANVAS_CONTRACT_ADDRESS,
          entrypoint: "create_canvas",
          calldata,
        });

        console.log("Canvas created, tx hash:", response.transaction_hash);
        return response.transaction_hash;
      } catch (error) {
        console.error("Failed to create canvas:", error);
        return null;
      }
    },
    [account, invokeContract]
  );

  const addStencil = useCallback(
    async (worldId: number, hash: string, width: number, height: number, position: number): Promise<string | null> => {
      if (!account) {
        console.error("Account not connected");
        return null;
      }

      try {
        const calldata = [worldId, hash, width, height, position];

        console.log("Adding stencil:", { worldId, hash, width, height, position });

        const response = await invokeContract({
          contractAddress: CANVAS_CONTRACT_ADDRESS,
          entrypoint: "add_stencil",
          calldata,
        });

        console.log("Stencil added, tx hash:", response.transaction_hash);
        return response.transaction_hash;
      } catch (error) {
        console.error("Failed to add stencil:", error);
        return null;
      }
    },
    [account, invokeContract]
  );

  const favoriteStencil = useCallback(
    async (worldId: number, stencilId: number): Promise<string | null> => {
      if (!account) {
        console.error("Account not connected");
        return null;
      }

      try {
        const calldata = [worldId, stencilId];

        console.log("Favoriting stencil:", { worldId, stencilId });

        const response = await invokeContract({
          contractAddress: CANVAS_CONTRACT_ADDRESS,
          entrypoint: "favorite_stencil",
          calldata,
        });

        console.log("Stencil favorited, tx hash:", response.transaction_hash);
        return response.transaction_hash;
      } catch (error) {
        console.error("Failed to favorite stencil:", error);
        return null;
      }
    },
    [account, invokeContract]
  );

  const unfavoriteStencil = useCallback(
    async (worldId: number, stencilId: number): Promise<string | null> => {
      if (!account) {
        console.error("Account not connected");
        return null;
      }

      try {
        const calldata = [worldId, stencilId];

        console.log("Unfavoriting stencil:", { worldId, stencilId });

        const response = await invokeContract({
          contractAddress: CANVAS_CONTRACT_ADDRESS,
          entrypoint: "unfavorite_stencil",
          calldata,
        });

        console.log("Stencil unfavorited, tx hash:", response.transaction_hash);
        return response.transaction_hash;
      } catch (error) {
        console.error("Failed to unfavorite stencil:", error);
        return null;
      }
    },
    [account, invokeContract]
  );

  // Refresh username when address changes
  useEffect(() => {
    if (address) {
      refreshUsername();
    } else {
      setUsername(null);
    }
  }, [address, refreshUsername]);

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
    username,
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
    getUsernameForAddress,
    getUsernamesForAddresses,
    claimUsername,
    isUsernameClaimed,
    refreshUsername,
    deployAccount,
    getBalance,
    placePixel,
    placePixels,
    createCanvas,
    addStencil,
    favoriteStencil,
    unfavoriteStencil,
  };

  return (
    <ZtarknetConnectorContext.Provider value={value}>
      {children}
    </ZtarknetConnectorContext.Provider>
  );
};
