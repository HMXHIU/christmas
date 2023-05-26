import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Transaction, Connection, Signer } from '@solana/web3.js'

export const signAndSendTx = async (
  connection: Connection,
  tx: Transaction,
  wallet: AnchorWallet,
  signers?: Array<Signer>
) => {
  tx.recentBlockhash = (
    await connection.getLatestBlockhash("singleGossip")
  ).blockhash;
  
  tx.feePayer = wallet.publicKey;
  if (signers) {
    tx.partialSign(...signers);
  }
  const signedTx = await wallet.signTransaction(tx);
  const rawTransaction = signedTx.serialize();
  const txSig = await connection.sendRawTransaction(rawTransaction);

  const latestBlockHash = await connection.getLatestBlockhash();

  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txSig,
  });

  return txSig;
};