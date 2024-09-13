# Player Transactions

Certain actions such as `learn`, `trade` require 2 players to acknowledge before the action is taken my the server. This is similar to a transaction on the blockchain, but for data not stored on the chain, there is no need to use a blockchain solana. Instead we can use message signing (free) or JWT.

#### Requesting to `learn` a skill from another player

1. playerOne `learn exploration from playerTwo`
2. The server knows that playerOne is already authenticated (no need any signing)
3. If the server detects that `playerTwo` is a human
4. Server sends a `CTA` message to `playerTwo`, (JWT or solana message signing)
   - The command is encoded in the transaction
   - The server does not need to wait and can end the request
   - A `TTL` for the transaction should also be added for its validity
5. `playerTwo` sends back the `cta` to server
6. Server receives the signed message which includes the command to run and executes it
   - Create and endpoint to receive player transactions (which also executes commands in the transaction)

#### Requesting to `trade` with another player

Trade currencies (lumina, umbra) for items, or items for items. Player or NPC must put items up for trading, these items can be `browse` by a another player. Only items that are in the `browse` list can be traded

1. playerOne `trade [item | currency] for [item | currency] with playerTwo`
2. A transaction is created and sent to `playerTwo` who has `TTL` to respond to the transaction
3. Server checks that both entities have the items to exchange and exchanges it
   - For normal items, no solana needs to be deducted
   - For NFT items, solana needs to be deducted and some sent to game master account

#### Could quests also use transactions?

## Writs (CTA)

`writs` are `CTA` objects in the world that can be sent back to the server at a later time.

- The server must check that the conditions are met. eg. for `P2PActionTransaction`, check the `player` is the origin
- For trade writs, the player could be empty meaning anyone is allowed to execute the writ as long as the conditions are met
- The server should destroy the writ or log that it has been used
- The server should check the expiry of the `writ`
