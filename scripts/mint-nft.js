require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");

const API_URL = process.env.API_URL;
const web3 = createAlchemyWeb3(API_URL);

const contract = require("../artifacts/contracts/MyNFT.sol/MyNFT.json");
const contractAddress = "0x9f8732bdaa80bf4f1b28cf2cc7f8d19ffba56f12";
const nftContract = new web3.eth.Contract(contract.abi, contractAddress);

const PUBLIC_KEY = process.env.PUBLIC_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

async function uploadImageToIPFS(imagePath) {
    try {
        const formData = new FormData();
        formData.append("file", fs.createReadStream(imagePath));

        const metadata = JSON.stringify({
            name: path.basename(imagePath),
        });
        formData.append("pinataMetadata", metadata);

        const options = JSON.stringify({
            cidVersion: 0,
        });
        formData.append("pinataOptions", options);

        const response = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
            maxContentLength: "Infinity",
            headers: {
                "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
                pinata_api_key: process.env.PINATA_API_KEY,
                pinata_secret_api_key: process.env.PINATA_API_SECRET,
            },
        });

        return `ipfs://${response.data.IpfsHash}`;
    } catch (error) {
        console.error("Error uploading image to IPFS:", error);
        throw new Error("Could not upload image to IPFS");
    }
}

function getRandomImagePath() {
    const imagesDirectory = path.join(__dirname, "../images");
    const files = fs.readdirSync(imagesDirectory);
    const randomIndex = Math.floor(Math.random() * files.length);
    return path.join(imagesDirectory, files[randomIndex]);
}

async function uploadMetadataToIPFS(metadata) {
    try {
        const data = {
            pinataMetadata: {
                name: "nft-metadata.json",
            },
            pinataContent: metadata,
        };

        const response = await axios.post("https://api.pinata.cloud/pinning/pinJSONToIPFS", data, {
            headers: {
                pinata_api_key: process.env.PINATA_API_KEY,
                pinata_secret_api_key: process.env.PINATA_API_SECRET,
            },
        });

        return `ipfs://${response.data.IpfsHash}`;
    } catch (error) {
        console.error("Error uploading metadata to IPFS:", error);
        throw new Error("Could not upload metadata to IPFS");
    }
}

function generateRandomMetadata(imageURI) {
    const randomId = Math.floor(Math.random() * 10000);
    return {
        name: `Random NFT #${randomId}`,
        description: "This is a randomly generated NFT",
        image: imageURI,
        attributes: [
            {
                trait_type: "Uniqueness",
                value: Math.floor(Math.random() * 100),
            },
            {
                trait_type: "Rarity",
                value: Math.floor(Math.random() * 100),
            },
        ],
    };
}

async function mintNFT() {
    try {

        const randomImagePath = getRandomImagePath();
        const imageURI = await uploadImageToIPFS(randomImagePath);
        console.log("Image URI:", imageURI);


        const metadata = generateRandomMetadata(imageURI);
        const tokenURI = await uploadMetadataToIPFS(metadata);
        console.log("Token URI:", tokenURI);


        const nonce = await web3.eth.getTransactionCount(PUBLIC_KEY, "latest");

        const tx = {
            from: PUBLIC_KEY,
            to: contractAddress,
            nonce: nonce,
            gas: 500000,
            data: nftContract.methods.mintNFT(PUBLIC_KEY, tokenURI).encodeABI(),
        };

        const signPromise = web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
        signPromise
            .then((signedTx) => {
                web3.eth.sendSignedTransaction(signedTx.rawTransaction, function (err, hash) {
                    if (!err) {
                        console.log(
                            "The hash of your transaction is: ",
                            hash,
                            "\nCheck Alchemy's Mempool to view the status of your transaction!"
                        );
                    } else {
                        console.log("Something went wrong when submitting your transaction:", err);
                    }
                });
            })
            .catch((err) => {
                console.error("Promise failed:", err);
            });
    } catch (error) {
        console.error("Error in minting NFT:", error);
    }
}

mintNFT();
