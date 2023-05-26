import React, { useState, useEffect } from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import WalletIcon from '@mui/icons-material/Wallet';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Transaction, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { signAndSendTx } from '../utils/utils';


// need this if not it will complain missing buffer 
window.Buffer = window.Buffer || require("buffer").Buffer;

// TODO remove, this demo shouldn't need to reset the theme.
const defaultTheme = createTheme();

const Login = () => {
  const wallet = useAnchorWallet();
  const { connection } = useConnection()

  const [currentState, setCurrentState] = useState({});

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (wallet && wallet.publicKey && currentState.fromWallet && currentState.toWallet && currentState.amount) {
      const toPublicKey = new PublicKey(currentState.toWallet)
      const tx = new Transaction();
      console.log(">>>>>>>>", {
        fromPubkey: wallet.publicKey.toString(),
        toPubkey: toPublicKey.toString(),
        lamports: currentState.amount * LAMPORTS_PER_SOL,
      })

      tx.add(SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: toPublicKey,
        lamports: currentState.amount * LAMPORTS_PER_SOL,
      }))

      const txSig = await signAndSendTx(connection, tx, wallet)
        .catch((error) => console.log(error));
      console.log(`https://solscan.io/tx/${txSig}?cluster=devnet`);
      setCurrentState({})
    }
  };

  useEffect(() => {
    if (wallet && wallet.publicKey && !currentState.fromWallet) {
      setCurrentState({ ...currentState, 'fromWallet': wallet.publicKey })
    }
  }, [wallet, currentState])


  return (
    <ThemeProvider theme={defaultTheme}>
      <Grid container component="main" sx={{ height: '100vh' }}>
        <CssBaseline />
        <Grid
          item
          xs={false}
          sm={4}
          md={7}
          sx={{
            backgroundImage: 'url(https://source.unsplash.com/random?wallpapers)',
            backgroundRepeat: 'no-repeat',
            backgroundColor: (t) =>
              t.palette.mode === 'light' ? t.palette.grey[50] : t.palette.grey[900],
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <Grid item xs={12} sm={8} md={5} component={Paper} elevation={6} square>
          <Box
            sx={{
              my: 8,
              mx: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Grid
              container
              direction="row"
              justifyContent="flex-end"
              alignItems="center"
            >
              <Grid item>
                <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
                  <WalletIcon />
                </Avatar>
              </Grid>
              <Grid item>
                <WalletMultiButton />
              </Grid>
            </Grid>

            {wallet && wallet.publicKey && (
              <Box component="form" noValidate onSubmit={handleSubmit} sx={{ mt: 5 }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="fromWallet"
                  label="From wallet"
                  name="fromWallet"
                  defaultValue={wallet.publicKey}
                  autoFocus
                  onChange={(e) => setCurrentState({ ...currentState, 'fromWallet': e.target.value })}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="toWallet"
                  label="To wallet"
                  name="toWallet"
                  autoFocus
                  onChange={(e) => setCurrentState({ ...currentState, 'toWallet': e.target.value })}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  type="number"
                  id="amount"
                  label="Amount"
                  name="amount"
                  autoFocus
                  onChange={(e) => setCurrentState({ ...currentState, 'amount': e.target.value })}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{ mt: 3, mb: 2 }}
                >
                  Transfer
                </Button>
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>
    </ThemeProvider>
  );
}

export default Login;