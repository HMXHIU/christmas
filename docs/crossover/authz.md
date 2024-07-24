## cmd:login

```typescript
// s3
interface UserMetadata {
  publicKey;
  region;
  crossover: {
    player; // publicKey
    name;
    tile; // geohash
  };
}

// redis
class Player extends Entity {}
const personSchema = new Schema(Player, {
  player: { type: "string" }, // publicKey
  name: { type: "string" },
  tile: { type: "string" },
  loggedIn: { type: "boolean" }, // only on redis
});
```

1. If user not in redis, load from s3
2. Set `loggedIn=True`
3. Pub `Login` to `player:publicKey`
4. Pub `Login` to `player:<Players in tile>`

## cmd:logout

1. Set `loggedIn=False` in redis
2. Pub `Logout` to `player:publicKey`
3. Pub `Logout` to `player:<Players in tile>`
