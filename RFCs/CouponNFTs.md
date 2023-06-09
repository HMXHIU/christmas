## Geohashing

Use geohasing to allow sellers to advertise to only a select region. Also allow users to receive coupons relevant to them

https://www.pubnub.com/guides/what-is-geohashing/


### Get all Users within 10 km of a geohash

```rust
#[account]
pub struct User {
    pub two_factor: [u8; 32],
    pub region: String,
    pub geo: String,
    pub bump: u8,
}
```

1. How do we query all users in the vicinity of approximately 10 km of a geohash

Can we filter the `geo` last byte?