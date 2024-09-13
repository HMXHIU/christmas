# Player Transactions

Certain actions such as `learn`, `trade` require 2 players to acknowledge before the action is taken my the server. This is similar to a transaction on the blockchain, but for data not stored on the chain, there is no need to use a blockchain solana. Instead we can use message signing (free).

#### Requesting to `learn` a skill from another player

1. playerOne `learn exploration from playerTwo`
2. The server knows that playerOne is already authenticated (no need any signing)
3. If the server detects that `playerTwo` is a human
4. Server sends a `requestTransaction` message to `playerTwo`, (Pops up the solana wallet to sign message OR use CLI to acknowledge)
   - The command is encoded in the transaction
   - The server does not need to wait and can end the request
5. `playerTwo` sends back the signed message to server
6. Server receives the signed message which includes the command to run and executes it
   - Create and endpoint to receive player transactions (which also executes commands in the transaction)

Note:

- We do not need to use the solana wallet, it could use the CLI where the player just responds with "teach playerTwo"
- A `TTL` for the transaction should also be added for its validity
- Could use a signed JWT on the server, send to player, and create an endpoint which reads the JWT

#### Requesting to `trade` with another player

1. playerOne `trade [item] for [item] with playerTwo`
2. A transaction is created and sent to `playerTwo` who has `TTL` to respond to the transaction
3. Server checks that both entities have the items to exchange and exchanges it
   - For normal items, no solana needs to be deducted
   - For NFT items, solana needs to be deducted and some sent to game master account

#### Could quests also use transactions?

## Writs

`writs` are `P2PTransaction` objects in the world that can be sent back to the server at a later time.

- The server must check that the conditions are met. eg. for `P2PActionTransaction`, check the `player` is the origin
- For trade writs, the player could be empty meaning anyone is allowed to execute the writ as long as the conditions are met
- The server should destroy the writ or log that it has been used
- The server should check the expiry
- Actions such as `learn` should take in a parameter `writ` to differentiate if the actinon is triggered by a writ or a player
