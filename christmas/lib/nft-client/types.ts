import { NFTMinioClient } from "./nftMinioClient";
import { NFTStorageClient } from "./nftStorageClient";

export type NFTClient = NFTMinioClient | NFTStorageClient;
