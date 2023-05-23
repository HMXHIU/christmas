## Initialization

_Init_

```bash
anchor init christmas-web3
```

_Set wallet to local_

In `Anchor.toml` set the following

```toml
[registry]
url = "http://localhost:8899"

[provider]
cluster = "Localnet"
wallet = "/Users/benjaminhon/Developer/christmas/id_local.json"
```

_Build_

```bash
anchor build
```

_Deploy_

```bash
anchor deploy

# Note down the new actual program id
Program Id: xxxxxxxxxxx
```

_Set the correct program id for the project in the follow files_

1. `Anchor.toml`
2. `src/lib.rs`

```bash
anchor build
anchor deploy
```

_Find Program on explorer_

1. Go to [Solana Explorer](https://explorer.solana.com/)
2. Find the program id

# Testing

```bash
solana-test-validator --quiet
anchor test --skip-local-validator
```
