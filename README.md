# Christmas Protocol

Christmas Protocol on Solana

## Development Environment

### Setup Solana Localnet

_Helpful Commands_

```bash
solana config get  # get current solana config
solana-keygen pubkey ./id_local.json  # get public key of a private key
```

_Run local solana validator_

```bash
solana-test-validator  # [--quiet]
```

_Generate keypair_

```bash
solana-keygen new -o ./id_local.json
```

_Set solana config to local_

```bash
solana config set --url localhost --keypair /Users/benjaminhon/Developer/christmas/id_local.json
```

_Airdrop till you drop_

```bash
solana airdrop 1000
```

### Testing & Exploring on Local Validator

1. Go to [Solana Explorer](https://explorer.solana.com/)
2. Select Custom RPC URL (http://localhost:8899)
3. After Airdropping some solana, search for your pubkey in the explorer
