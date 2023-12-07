export type Christmas = {
  "version": "0.1.0",
  "name": "christmas",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "programState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "createUser",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "region",
          "type": "string"
        },
        {
          "name": "geo",
          "type": "string"
        }
      ]
    },
    {
      "name": "createCoupon",
      "accounts": [
        {
          "name": "mint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "coupon",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "regionMarket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "regionMarketTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "region",
          "type": "string"
        },
        {
          "name": "geo",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        }
      ]
    },
    {
      "name": "redeemCoupon",
      "accounts": [
        {
          "name": "coupon",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "user",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "numTokens",
          "type": "u64"
        }
      ]
    },
    {
      "name": "mintToMarket",
      "accounts": [
        {
          "name": "regionMarket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "regionMarketTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "region",
          "type": "string"
        },
        {
          "name": "numTokens",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimFromMarket",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "regionMarketTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "regionMarket",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "coupon",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "numTokens",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "coupon",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "updateAuthority",
            "type": "publicKey"
          },
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "region",
            "type": "string"
          },
          {
            "name": "geo",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "regionMarket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "region",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "programState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isInitialized",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "user",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "region",
            "type": "string"
          },
          {
            "name": "geo",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};

export const IDL: Christmas = {
  "version": "0.1.0",
  "name": "christmas",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "programState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "createUser",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "region",
          "type": "string"
        },
        {
          "name": "geo",
          "type": "string"
        }
      ]
    },
    {
      "name": "createCoupon",
      "accounts": [
        {
          "name": "mint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "coupon",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "regionMarket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "regionMarketTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "region",
          "type": "string"
        },
        {
          "name": "geo",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        }
      ]
    },
    {
      "name": "redeemCoupon",
      "accounts": [
        {
          "name": "coupon",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "user",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "numTokens",
          "type": "u64"
        }
      ]
    },
    {
      "name": "mintToMarket",
      "accounts": [
        {
          "name": "regionMarket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "regionMarketTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "region",
          "type": "string"
        },
        {
          "name": "numTokens",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimFromMarket",
      "accounts": [
        {
          "name": "user",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "regionMarketTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "regionMarket",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "coupon",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "numTokens",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "coupon",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "updateAuthority",
            "type": "publicKey"
          },
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "region",
            "type": "string"
          },
          {
            "name": "geo",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "regionMarket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "region",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "programState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isInitialized",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "user",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "region",
            "type": "string"
          },
          {
            "name": "geo",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
