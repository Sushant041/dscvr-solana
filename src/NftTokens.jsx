import React, { useState, useEffect } from "react";
import nfts from "./nfts";
import idl from "./idl.json";
import { GraphQLClient, gql } from "graphql-request";
import useCanvasWallet from "./CanvasWalletProvider";
import BN from "bn.js";
import { PublicKey, clusterApiUrl, Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import Modal from "react-modal";

const client = new GraphQLClient("https://api.dscvr.one/graphql");

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
  const {
    walletAddress,
    userInfo,
    signTransaction,
    connectWallet,
    signAllTransactions,
  } = useCanvasWallet();
  const [userData, setUserData] = useState(null);
  const [nftName, setNftName] = useState('');
  const [isConfirmModalOpen, setisConfirmModalOpen] = useState(false);

  const fetchUserData = async (username) => {
    try {
      setLoading(true);
      const data = await client.request(GET_USER_DATA, { username });
      setUserData(data.userByName);
      setLoading(false);
    } catch (err) {
      setError("Failed to fetch user data");
      setLoading(false);
    }
  };

  const customStyles = {
    content: {
      position: "absolute",
      inset: "12% 40px 40px 5%",
      border: "none",
      backgroundColor: "rgb(30, 41, 59)",
      overflow: "auto",
      borderRadius: "8px",
      outline: "none",
      padding: "20px",
      color: "rgb(255, 255, 255)",
      width: "400px",
      margin: "auto",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center", // Removing border for a cleaner look // Ensure perfect centering
    },
    overlay: {
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      zIndex: "1000" // Transparent dark overlay
      },
  };

  useEffect(() => {
    if (userInfo) {
      fetchUserData(userInfo.username);
    }
  }, [userInfo]);

  const handleMint = async () => {
    try {
      if (!walletAddress) {
        await connectWallet();
        console.error("Wallet not connected");
        toast.error("Please connect your wallet first.");
        return null;
      }

      const asset = Keypair.generate();
      const assetPublicKey = asset.publicKey;
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

      const anchorProvider = new AnchorProvider(
        connection,
        {
          publicKey: new PublicKey(walletAddress),
          signTransaction,
          signAllTransactions,
        },
        {
          commitment: "confirmed",
        }
      );

      const program = new Program(idl, anchorProvider);

      const accounts = {
        signer: anchorProvider.wallet.publicKey,
        payer: anchorProvider.wallet.publicKey,
        asset: assetPublicKey,
        database: new PublicKey("5ahNFeoYAS4HayZWK6osa6ZiocNojNJcfzgUJASicRbf"),
      };

      console.log( "userData: " + userData,
        nftName,
        new BN(userData?.followerCount),
        new BN(userData?.streak?.dayCount),
        new BN(userData?.dscvrPoints),
        userInfo.username
      );

      const transaction = await program.methods
        .createAsset(
          nftName,
          new BN(userData.followerCount),
          new BN(userData?.streak?.dayCount),
          new BN(userData.dscvrPoints),
          userInfo.username
        )
        .accounts(accounts)
        .signers([asset])
        .rpc();

      console.log("Transaction", transaction);
    } catch (error) {         
      console.error("Error during minting process:", error);
    }
  };

  const handleConfirm = () =>{
    setisConfirmModalOpen(false);
    handleMint();
  }

  return (
    <div className="flex flex-wrap text-xs justify-around p-4">
      {nfts.map((nft, index) => {
        const achievement = mintData?.achievements[index];
        const isAlreadyMinted = achievement?.wallets.some(
          (wallet) => wallet?.walletAddress === walletAddress
        );

        let mintCondition = null;

        // if (achievement?.currentCount >= achievement?.maxNftCap) {
          // If max cap is reached, check if user already minted
        //   if (isAlreadyMinted) {
        //     mintCondition = (
        //       <p className="text-sm text-green-500 font-semibold">
        //         Already Minted
        //       </p>
        //     );
        //   } else {
        //     mintCondition = (
        //       <p className="text-sm w-full text-red-500" disabled="true">
        //         Max limit reached
        //       </p>
        //     );
        //   }
        // } else {
          // Max cap not reached, apply the mint conditions for specific indexes
          if (index === 2) {
            mintCondition = (
              <button
                className="text-sm w-full text-indigo-400"
                onClick={() => { setNftName(nft.codeName); setisConfirmModalOpen(true); }}
              >
                Mint
              </button>)
            // First NFT: Check if dscvrPoints >= 1,000,000
            // if (userData?.dscvrPoints >= 1000000000 && !isAlreadyMinted) {
            //   mintCondition = (
            //     <button
            //       className="text-sm w-full text-indigo-400"
            //       onClick={() => { setNftName(nft.codeName); setisConfirmModalOpen(true); }}
            //     >
            //       Mint
            //     </button>
            //   );
            // } else if (isAlreadyMinted) {
            //   mintCondition = (
            //     <p className="text-sm text-green-500 font-semibold">
            //       Already Minted
            //     </p>
            //   );
            // } else {
            //   mintCondition = (
            //     <button
            //       className="text-sm w-full hover:border-red-600 text-red-500"
            //       disabled="true"
            //     >
            //       Locked
            //     </button>
            //   );
            // }
          } else if (index === 0) {
            // Second NFT: Check if followerCount >= 1
            if (userData?.followerCount >= 1 && !isAlreadyMinted) {
              mintCondition = (
                <button
                  className="text-sm w-full text-indigo-400"
                  onClick={() => { setNftName(nft.codeName); setisConfirmModalOpen(true); }}
                >
                  Mint
                </button>
              );
            } else if (isAlreadyMinted) {
              mintCondition = (
                <p className="text-sm text-green-500 font-semibold">
                  Already Minted
                </p>
              );
            } else {
              mintCondition = (
                <button
                  className="text-sm w-full hover:border-red-600 text-red-500"
                  disabled="true"
                >
                  Locked
                </button>
              );
            }
          } else if (index === 1) {
            // Third NFT: Check if streak.dayCount >= 3
            if (userData?.streak?.dayCount >= 3 && !isAlreadyMinted) {
              mintCondition = (
                <button
                  className="text-sm w-full text-indigo-400"
                  onClick={() => { setNftName(nft.codeName); setisConfirmModalOpen(true); }}
                >
                  Mint
                </button>
              );
            } else if (isAlreadyMinted) {
              mintCondition = (
                <p className="text-sm text-green-500 font-semibold">
                  Already Minted
                </p>
              );
            } else {
              mintCondition = (
                <button
                  className="text-sm w-full hover:border-red-600 text-red-500"
                  disabled="true"
                >
                  Locked
                </button>
              );
            }
          } else {
            // Other NFTs: Default mint logic
            mintCondition = isAlreadyMinted ? (
              <p className="text-sm text-green-500 font-semibold">
                Already Minted
              </p>
            ) : (
              <button
                className="text-sm w-full text-indigo-400"
                onClick={() => { setNftName(nft.codeName); setisConfirmModalOpen(true); }}
              >
                Mint
              </button>
            );
          }
        // }

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
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {nft.description}
                </p>
                <div className="absolute top-[-50px] w-[220px] left-[-20px] opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gray-900 p-4 border rounded-lg shadow-lg z-10">
                  <p className="text-gray-200">{nft.description}</p>
                </div>
              </div>
            </div>
            <div className="pb-2 px-2">
              <div className="text-sm font-semibold text">
                Minted till now: {achievement.currentCount}/
                {achievement.maxNftCap}
              </div>
              <div className="w-full bg-gray-600 rounded-lg h-1.5 dark:bg-gray-700 my-4">
                <div
                  className="bg-indigo-600 h-1.5 rounded-lg"
                  style={{
                    width: `${
                      (achievement.currentCount / achievement.maxNftCap) * 100
                    }%`,
                  }}
                ></div>
              </div>
              <div className="text-center">{mintCondition}</div>
            </div>
          </div>
        );
      })}
      <Modal
        style={customStyles}
        isOpen={isConfirmModalOpen}
        onRequestClose={() => setisConfirmModalOpen(false)}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignContent: "center",
          }}
        >
          <p style={{
            background: "#1a1e1e",
            padding: "10px",
            borderRadius: "5px",
            color: "orange",
            fontSize: "20px",
          }}>
            Before making this transection make sure you have enough balance in
            your wallet!!
          </p>
          <div>
            <button
              type="button"
              style={{
                padding: "12px 24px",
                border: "none",
                width: "100%",
                borderRadius: "4px",
                backgroundColor: "rgb(99, 102, 241)",
                color: "#fff",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                transition: "background-color 0.3s ease",
                marginBottom: "10px",
                marginTop: "10px",
              }}
              onClick={handleConfirm}
            >
              Confirm
            </button>
            <button
              type="button"
              style={{
                padding: "12px 24px",
                border: "none",
                width: "100%",
                borderRadius: "4px",
                backgroundColor: "#FF4C4C",
                color: "#fff",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                transition: "background-color 0.3s ease",
                marginBottom: "10px",
                marginTop: "10px",
              }}
              onClick={() => setisConfirmModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default NFTDisplay;
