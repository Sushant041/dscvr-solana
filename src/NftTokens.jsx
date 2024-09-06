import React, { useState, useEffect } from 'react';
import nfts from './nfts';
import idl from './idl.json'
import { GraphQLClient, gql } from 'graphql-request';
import useCanvasWallet from "./CanvasWalletProvider";
import { useWallet } from '@solana/wallet-adapter-react';
import { web3 } from '@coral-xyz/anchor';

import BN from 'bn.js';
import {
    PublicKey,
    clusterApiUrl,
    Connection,
    Keypair
} from "@solana/web3.js";
import {
    AnchorProvider,
    Program,
} from "@coral-xyz/anchor";
import { toast } from 'react-toastify';

const client = new GraphQLClient('https://api.dscvr.one/graphql');

// Define the GraphQL query for fetching user data by username
const GET_USER_DATA = gql`
  query GetUserData($username: String!) {
    userByName(name: $username) {
      id
      followingCount
      followerCount
      dscvrPoints
      streak {
        dayCount
        multiplierCount
      }
    }
  }
`;


export const NFTDisplay = ({ mintData }) => {
    const { walletAddress, userInfo, signTransaction } = useCanvasWallet();
    const { sendTransaction } = useWallet();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchUserData = async (username) => {
        try {
            setLoading(true);
            const data = await client.request(GET_USER_DATA, { username });
            setUserData(data.userByName);
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch user data');
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userInfo) {
            fetchUserData(userInfo.username);
        }
    }, [userInfo]);

    const handleMint = async (nftName, username) => {
        try {
            // Generate a new keypair for the asset
            const asset = Keypair.generate();
            const assetPublicKey = asset.publicKey;

            console.log("Generated Asset Public Key:", assetPublicKey.toBase58());

            // Create a connection to Solana Devnet
            const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

            console.log("Created connection:", connection);

            // Create an AnchorProvider with the wallet address and signTransaction function
            const provider = new AnchorProvider(connection, {
                publicKey: new PublicKey(walletAddress),
                signTransaction
            }, {
                commitment: "confirmed",
            });

            console.log("Provider created with wallet:", provider);

            // Initialize the program with IDL and provider
            const program = new Program(idl, provider);
            console.log("Program initialized:", program);

            // Log the data to be passed into the createAsset method
            console.log("Minting NFT with the following data:");
            // console.log("NFT Name:", nft.codeName);
            console.log("Username:", username);
            console.log("Follower Count (BN):", new BN(userData.followerCount).toString());
            console.log("DSCVR Points (BN):", new BN(userData.dscvrPoints).toString());
            console.log("Streak Day Count (BN):", new BN(userData.streak?.dayCount).toString());

            // Prepare account details
            const accounts = {
                signer: new PublicKey(walletAddress),
                payer: new PublicKey(walletAddress),
                asset: assetPublicKey,
                database: new PublicKey('5ahNFeoYAS4HayZWK6osa6ZiocNojNJcfzgUJASicRbf'),
            };

            console.log("Accounts info:", accounts);

            // Mint the NFT by calling the program's createAsset method
            const tx = new web3.Transaction().add(
                await program.methods
                    .createAsset(
                        nftName,                     // NFT code name
                        new BN(userData.followerCount),   // Convert userData to BN (BigNumber)
                        new BN(userData.dscvrPoints),     // Convert DSCVR points to BN
                        new BN(userData.streak?.dayCount), // Convert streak day count to BN
                        username                 // Username string
                    )
                    .accounts(accounts)
                    .instruction()
            );

            let txSignature;

            try {
                if (walletAddress) {
                    // Sign the transaction with the connected wallet
                    const signedTx = await signTransaction(tx); // Ensure signTransaction is properly implemented
                    txSignature = await sendTransaction(signedTx, connection, { signers: [] });
                } else {
                    // No wallet available, send the transaction directly (though typically, signing is required)
                    txSignature = await sendTransaction(tx, connection, { signers: [] });
                }

                console.log("Transaction successful, tx hash:", txSignature);
            } catch (error) {
                console.error("Transaction failed:", error);
            }
            // Provide feedback or update UI after successful minting
            // toast.success("NFT successfully minted!");
        } catch (error) {
            // Handle any errors that occur during the transaction
            console.error("Error during minting process:", error);
            toast.error("Failed to mint NFT.");
        }
    };


    return (
        <div className="flex flex-wrap text-xs justify-around p-4">
            {nfts.map((nft, index) => {
                const achievement = mintData?.achievements[index];
                const isAlreadyMinted = achievement?.wallets.some(wallet => wallet?.walletAddress === walletAddress);

                let mintCondition = null;

                if (achievement?.currentCount >= achievement?.maxNftCap) {
                    // If max cap is reached, check if user already minted
                    if (isAlreadyMinted) {
                        mintCondition = <p className="text-sm text-green-500 font-semibold">Already Minted</p>;
                    } else {
                        mintCondition = <p className="text-sm w-full text-red-500" disabled="true">Max limit reached</p>;
                    }
                } else {
                    // Max cap not reached, apply the mint conditions for specific indexes
                    if (index === 2) {
                        // First NFT: Check if dscvrPoints >= 1,000,000
                        if (userData?.dscvrPoints >= 1000000000 && !isAlreadyMinted) {
                            mintCondition = (
                                <button
                                    className="text-sm w-full text-indigo-400"
                                    onClick={() => handleMint(nft.codeName, userInfo.username)}
                                >
                                    Mint
                                </button>
                            );
                        } else if (isAlreadyMinted) {
                            mintCondition = <p className="text-sm text-green-500 font-semibold">Already Minted</p>;
                        } else {
                            mintCondition = <button className="text-sm w-full hover:border-red-600 text-red-500" disabled="true">Locked</button>;
                        }
                    } else if (index === 0) {
                        // Second NFT: Check if followerCount >= 1
                        if (userData?.followerCount >= 1 && !isAlreadyMinted) {
                            mintCondition = (
                                <button
                                    className="text-sm w-full text-indigo-400"
                                    onClick={() => handleMint(nft.codeName, userInfo.username)}
                                >
                                    Mint
                                </button>
                            );
                        } else if (isAlreadyMinted) {
                            mintCondition = <p className="text-sm text-green-500 font-semibold">Already Minted</p>;
                        } else {
                            mintCondition = <button className="text-sm w-full hover:border-red-600 text-red-500" disabled="true">Locked</button>;
                        }
                    } else if (index === 1) {
                        // Third NFT: Check if streak.dayCount >= 3
                        if (userData?.streak?.dayCount >= 3 && !isAlreadyMinted) {
                            mintCondition = (
                                <button
                                    className="text-sm w-full text-indigo-400"
                                    onClick={() => handleMint(nft.codeName, userInfo.username)}
                                >
                                    Mint
                                </button>
                            );
                        } else if (isAlreadyMinted) {
                            mintCondition = <p className="text-sm text-green-500 font-semibold">Already Minted</p>;
                        } else {
                            mintCondition = <button className="text-sm w-full hover:border-red-600 text-red-500" disabled="true">Locked</button>;
                        }
                    } else {
                        // Other NFTs: Default mint logic
                        mintCondition = isAlreadyMinted ? (
                            <p className="text-sm text-green-500 font-semibold">Already Minted</p>
                        ) : (
                            <button
                                className="text-sm w-full text-indigo-400"
                                onClick={() => handleMint(nft.codeName, userInfo.username)}
                            >
                                Mint
                            </button>
                        );
                    }
                }

                return (
                    <div
                        key={index}
                        className="shadow-lg border border-slate-700 rounded-lg overflow-hidden max-w-[200px] w-full"
                    >
                        <img
                            src={nft.image}
                            alt={nft.name}
                            className="w-full h-[100px] object-cover"
                        />
                        <div className="p-2">
                            <h6 className="text-sm font-bold mb-2">{nft.name}</h6>
                            <div className="relative">
                                <p
                                    className="text-gray-400 overflow-hidden text-ellipsis"
                                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                                >
                                    {nft.description}
                                </p>
                                <div
                                    className="absolute top-[-50px] w-[220px] left-[-20px] opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gray-900 p-4 border rounded-lg shadow-lg z-10"
                                >
                                    <p className="text-gray-200">
                                        {nft.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="pb-2 px-2">
                            <div className="text-sm font-semibold text">
                                Minted till now: {achievement.currentCount}/{achievement.maxNftCap}
                            </div>
                            <div className="w-full bg-gray-600 rounded-lg h-1.5 dark:bg-gray-700 my-4">
                                <div
                                    className="bg-indigo-600 h-1.5 rounded-lg"
                                    style={{ width: `${(achievement.currentCount / achievement.maxNftCap) * 100}%` }}
                                ></div>
                            </div>
                            <div className="text-center">
                                {mintCondition}
                            </div>

                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default NFTDisplay;
