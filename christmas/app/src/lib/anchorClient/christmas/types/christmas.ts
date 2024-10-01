export type Christmas = {
    version: "0.1.0";
    name: "christmas";
    instructions: [
        {
            name: "initialize";
            accounts: [
                {
                    name: "programState";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "signer";
                    isMut: true;
                    isSigner: true;
                },
                {
                    name: "systemProgram";
                    isMut: false;
                    isSigner: false;
                },
            ];
            args: [];
        },
        {
            name: "createUser";
            accounts: [
                {
                    name: "user";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "payer";
                    isMut: true;
                    isSigner: true;
                },
                {
                    name: "signer";
                    isMut: false;
                    isSigner: true;
                },
                {
                    name: "systemProgram";
                    isMut: false;
                    isSigner: false;
                },
            ];
            args: [
                {
                    name: "region";
                    type: {
                        array: ["u8", 3];
                    };
                },
                {
                    name: "uri";
                    type: "string";
                },
            ];
        },
        {
            name: "updateUser";
            accounts: [
                {
                    name: "user";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "payer";
                    isMut: true;
                    isSigner: true;
                },
                {
                    name: "signer";
                    isMut: false;
                    isSigner: true;
                },
            ];
            args: [
                {
                    name: "region";
                    type: {
                        array: ["u8", 3];
                    };
                },
                {
                    name: "uri";
                    type: "string";
                },
            ];
        },
        {
            name: "createStore";
            accounts: [
                {
                    name: "store";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "signer";
                    isMut: false;
                    isSigner: true;
                },
                {
                    name: "payer";
                    isMut: true;
                    isSigner: true;
                },
                {
                    name: "state";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "systemProgram";
                    isMut: false;
                    isSigner: false;
                },
            ];
            args: [
                {
                    name: "name";
                    type: "string";
                },
                {
                    name: "id";
                    type: "u64";
                },
                {
                    name: "region";
                    type: {
                        array: ["u8", 3];
                    };
                },
                {
                    name: "geohash";
                    type: {
                        array: ["u8", 6];
                    };
                },
                {
                    name: "uri";
                    type: "string";
                },
            ];
        },
        {
            name: "createCoupon";
            accounts: [
                {
                    name: "mint";
                    isMut: true;
                    isSigner: true;
                },
                {
                    name: "coupon";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "regionMarket";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "regionMarketTokenAccount";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "store";
                    isMut: false;
                    isSigner: false;
                },
                {
                    name: "signer";
                    isMut: false;
                    isSigner: true;
                },
                {
                    name: "payer";
                    isMut: true;
                    isSigner: true;
                },
                {
                    name: "systemProgram";
                    isMut: false;
                    isSigner: false;
                },
                {
                    name: "tokenProgram";
                    isMut: false;
                    isSigner: false;
                },
                {
                    name: "associatedTokenProgram";
                    isMut: false;
                    isSigner: false;
                },
            ];
            args: [
                {
                    name: "name";
                    type: "string";
                },
                {
                    name: "region";
                    type: {
                        array: ["u8", 3];
                    };
                },
                {
                    name: "geohash";
                    type: {
                        array: ["u8", 6];
                    };
                },
                {
                    name: "uri";
                    type: "string";
                },
                {
                    name: "validFrom";
                    type: "u64";
                },
                {
                    name: "validTo";
                    type: "u64";
                },
            ];
        },
        {
            name: "redeemCoupon";
            accounts: [
                {
                    name: "coupon";
                    isMut: false;
                    isSigner: false;
                },
                {
                    name: "mint";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "user";
                    isMut: false;
                    isSigner: false;
                },
                {
                    name: "userTokenAccount";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "signer";
                    isMut: false;
                    isSigner: true;
                },
                {
                    name: "payer";
                    isMut: true;
                    isSigner: true;
                },
                {
                    name: "tokenProgram";
                    isMut: false;
                    isSigner: false;
                },
            ];
            args: [
                {
                    name: "numTokens";
                    type: "u64";
                },
            ];
        },
        {
            name: "mintToMarket";
            accounts: [
                {
                    name: "regionMarket";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "regionMarketTokenAccount";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "mint";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "coupon";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "signer";
                    isMut: false;
                    isSigner: true;
                },
                {
                    name: "payer";
                    isMut: true;
                    isSigner: true;
                },
                {
                    name: "systemProgram";
                    isMut: false;
                    isSigner: false;
                },
                {
                    name: "associatedTokenProgram";
                    isMut: false;
                    isSigner: false;
                },
                {
                    name: "tokenProgram";
                    isMut: false;
                    isSigner: false;
                },
            ];
            args: [
                {
                    name: "region";
                    type: {
                        array: ["u8", 3];
                    };
                },
                {
                    name: "numTokens";
                    type: "u64";
                },
            ];
        },
        {
            name: "claimFromMarket";
            accounts: [
                {
                    name: "user";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "userTokenAccount";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "regionMarketTokenAccount";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "regionMarket";
                    isMut: false;
                    isSigner: false;
                },
                {
                    name: "mint";
                    isMut: true;
                    isSigner: false;
                },
                {
                    name: "coupon";
                    isMut: false;
                    isSigner: false;
                },
                {
                    name: "payer";
                    isMut: true;
                    isSigner: true;
                },
                {
                    name: "signer";
                    isMut: false;
                    isSigner: true;
                },
                {
                    name: "associatedTokenProgram";
                    isMut: false;
                    isSigner: false;
                },
                {
                    name: "tokenProgram";
                    isMut: false;
                    isSigner: false;
                },
                {
                    name: "systemProgram";
                    isMut: false;
                    isSigner: false;
                },
            ];
            args: [
                {
                    name: "numTokens";
                    type: "u64";
                },
            ];
        },
    ];
    accounts: [
        {
            name: "coupon";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "updateAuthority";
                        type: "publicKey";
                    },
                    {
                        name: "mint";
                        type: "publicKey";
                    },
                    {
                        name: "name";
                        type: "string";
                    },
                    {
                        name: "uri";
                        type: "string";
                    },
                    {
                        name: "store";
                        type: "publicKey";
                    },
                    {
                        name: "validFrom";
                        type: "u64";
                    },
                    {
                        name: "validTo";
                        type: "u64";
                    },
                    {
                        name: "supply";
                        type: "u32";
                    },
                    {
                        name: "region";
                        type: {
                            array: ["u8", 3];
                        };
                    },
                    {
                        name: "geohash";
                        type: {
                            array: ["u8", 6];
                        };
                    },
                    {
                        name: "hasSupply";
                        type: "bool";
                    },
                    {
                        name: "validFromHash";
                        type: {
                            array: ["u8", 32];
                        };
                    },
                    {
                        name: "validToHash";
                        type: {
                            array: ["u8", 32];
                        };
                    },
                    {
                        name: "datehashOverflow";
                        type: "bool";
                    },
                    {
                        name: "bump";
                        type: "u8";
                    },
                ];
            };
        },
        {
            name: "regionMarket";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "region";
                        type: {
                            array: ["u8", 3];
                        };
                    },
                    {
                        name: "bump";
                        type: "u8";
                    },
                ];
            };
        },
        {
            name: "programState";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "isInitialized";
                        type: "bool";
                    },
                    {
                        name: "storeCounter";
                        type: "u64";
                    },
                    {
                        name: "bump";
                        type: "u8";
                    },
                ];
            };
        },
        {
            name: "store";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "id";
                        type: "u64";
                    },
                    {
                        name: "name";
                        type: "string";
                    },
                    {
                        name: "region";
                        type: {
                            array: ["u8", 3];
                        };
                    },
                    {
                        name: "geohash";
                        type: {
                            array: ["u8", 6];
                        };
                    },
                    {
                        name: "uri";
                        type: "string";
                    },
                    {
                        name: "owner";
                        type: "publicKey";
                    },
                    {
                        name: "bump";
                        type: "u8";
                    },
                ];
            };
        },
        {
            name: "user";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "region";
                        type: {
                            array: ["u8", 3];
                        };
                    },
                    {
                        name: "uri";
                        type: "string";
                    },
                    {
                        name: "bump";
                        type: "u8";
                    },
                ];
            };
        },
    ];
};

export const IDL: Christmas = {
    version: "0.1.0",
    name: "christmas",
    instructions: [
        {
            name: "initialize",
            accounts: [
                {
                    name: "programState",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "signer",
                    isMut: true,
                    isSigner: true,
                },
                {
                    name: "systemProgram",
                    isMut: false,
                    isSigner: false,
                },
            ],
            args: [],
        },
        {
            name: "createUser",
            accounts: [
                {
                    name: "user",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "payer",
                    isMut: true,
                    isSigner: true,
                },
                {
                    name: "signer",
                    isMut: false,
                    isSigner: true,
                },
                {
                    name: "systemProgram",
                    isMut: false,
                    isSigner: false,
                },
            ],
            args: [
                {
                    name: "region",
                    type: {
                        array: ["u8", 3],
                    },
                },
                {
                    name: "uri",
                    type: "string",
                },
            ],
        },
        {
            name: "updateUser",
            accounts: [
                {
                    name: "user",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "payer",
                    isMut: true,
                    isSigner: true,
                },
                {
                    name: "signer",
                    isMut: false,
                    isSigner: true,
                },
            ],
            args: [
                {
                    name: "region",
                    type: {
                        array: ["u8", 3],
                    },
                },
                {
                    name: "uri",
                    type: "string",
                },
            ],
        },
        {
            name: "createStore",
            accounts: [
                {
                    name: "store",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "signer",
                    isMut: false,
                    isSigner: true,
                },
                {
                    name: "payer",
                    isMut: true,
                    isSigner: true,
                },
                {
                    name: "state",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "systemProgram",
                    isMut: false,
                    isSigner: false,
                },
            ],
            args: [
                {
                    name: "name",
                    type: "string",
                },
                {
                    name: "id",
                    type: "u64",
                },
                {
                    name: "region",
                    type: {
                        array: ["u8", 3],
                    },
                },
                {
                    name: "geohash",
                    type: {
                        array: ["u8", 6],
                    },
                },
                {
                    name: "uri",
                    type: "string",
                },
            ],
        },
        {
            name: "createCoupon",
            accounts: [
                {
                    name: "mint",
                    isMut: true,
                    isSigner: true,
                },
                {
                    name: "coupon",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "regionMarket",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "regionMarketTokenAccount",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "store",
                    isMut: false,
                    isSigner: false,
                },
                {
                    name: "signer",
                    isMut: false,
                    isSigner: true,
                },
                {
                    name: "payer",
                    isMut: true,
                    isSigner: true,
                },
                {
                    name: "systemProgram",
                    isMut: false,
                    isSigner: false,
                },
                {
                    name: "tokenProgram",
                    isMut: false,
                    isSigner: false,
                },
                {
                    name: "associatedTokenProgram",
                    isMut: false,
                    isSigner: false,
                },
            ],
            args: [
                {
                    name: "name",
                    type: "string",
                },
                {
                    name: "region",
                    type: {
                        array: ["u8", 3],
                    },
                },
                {
                    name: "geohash",
                    type: {
                        array: ["u8", 6],
                    },
                },
                {
                    name: "uri",
                    type: "string",
                },
                {
                    name: "validFrom",
                    type: "u64",
                },
                {
                    name: "validTo",
                    type: "u64",
                },
            ],
        },
        {
            name: "redeemCoupon",
            accounts: [
                {
                    name: "coupon",
                    isMut: false,
                    isSigner: false,
                },
                {
                    name: "mint",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "user",
                    isMut: false,
                    isSigner: false,
                },
                {
                    name: "userTokenAccount",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "signer",
                    isMut: false,
                    isSigner: true,
                },
                {
                    name: "payer",
                    isMut: true,
                    isSigner: true,
                },
                {
                    name: "tokenProgram",
                    isMut: false,
                    isSigner: false,
                },
            ],
            args: [
                {
                    name: "numTokens",
                    type: "u64",
                },
            ],
        },
        {
            name: "mintToMarket",
            accounts: [
                {
                    name: "regionMarket",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "regionMarketTokenAccount",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "mint",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "coupon",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "signer",
                    isMut: false,
                    isSigner: true,
                },
                {
                    name: "payer",
                    isMut: true,
                    isSigner: true,
                },
                {
                    name: "systemProgram",
                    isMut: false,
                    isSigner: false,
                },
                {
                    name: "associatedTokenProgram",
                    isMut: false,
                    isSigner: false,
                },
                {
                    name: "tokenProgram",
                    isMut: false,
                    isSigner: false,
                },
            ],
            args: [
                {
                    name: "region",
                    type: {
                        array: ["u8", 3],
                    },
                },
                {
                    name: "numTokens",
                    type: "u64",
                },
            ],
        },
        {
            name: "claimFromMarket",
            accounts: [
                {
                    name: "user",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "userTokenAccount",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "regionMarketTokenAccount",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "regionMarket",
                    isMut: false,
                    isSigner: false,
                },
                {
                    name: "mint",
                    isMut: true,
                    isSigner: false,
                },
                {
                    name: "coupon",
                    isMut: false,
                    isSigner: false,
                },
                {
                    name: "payer",
                    isMut: true,
                    isSigner: true,
                },
                {
                    name: "signer",
                    isMut: false,
                    isSigner: true,
                },
                {
                    name: "associatedTokenProgram",
                    isMut: false,
                    isSigner: false,
                },
                {
                    name: "tokenProgram",
                    isMut: false,
                    isSigner: false,
                },
                {
                    name: "systemProgram",
                    isMut: false,
                    isSigner: false,
                },
            ],
            args: [
                {
                    name: "numTokens",
                    type: "u64",
                },
            ],
        },
    ],
    accounts: [
        {
            name: "coupon",
            type: {
                kind: "struct",
                fields: [
                    {
                        name: "updateAuthority",
                        type: "publicKey",
                    },
                    {
                        name: "mint",
                        type: "publicKey",
                    },
                    {
                        name: "name",
                        type: "string",
                    },
                    {
                        name: "uri",
                        type: "string",
                    },
                    {
                        name: "store",
                        type: "publicKey",
                    },
                    {
                        name: "validFrom",
                        type: "u64",
                    },
                    {
                        name: "validTo",
                        type: "u64",
                    },
                    {
                        name: "supply",
                        type: "u32",
                    },
                    {
                        name: "region",
                        type: {
                            array: ["u8", 3],
                        },
                    },
                    {
                        name: "geohash",
                        type: {
                            array: ["u8", 6],
                        },
                    },
                    {
                        name: "hasSupply",
                        type: "bool",
                    },
                    {
                        name: "validFromHash",
                        type: {
                            array: ["u8", 32],
                        },
                    },
                    {
                        name: "validToHash",
                        type: {
                            array: ["u8", 32],
                        },
                    },
                    {
                        name: "datehashOverflow",
                        type: "bool",
                    },
                    {
                        name: "bump",
                        type: "u8",
                    },
                ],
            },
        },
        {
            name: "regionMarket",
            type: {
                kind: "struct",
                fields: [
                    {
                        name: "region",
                        type: {
                            array: ["u8", 3],
                        },
                    },
                    {
                        name: "bump",
                        type: "u8",
                    },
                ],
            },
        },
        {
            name: "programState",
            type: {
                kind: "struct",
                fields: [
                    {
                        name: "isInitialized",
                        type: "bool",
                    },
                    {
                        name: "storeCounter",
                        type: "u64",
                    },
                    {
                        name: "bump",
                        type: "u8",
                    },
                ],
            },
        },
        {
            name: "store",
            type: {
                kind: "struct",
                fields: [
                    {
                        name: "id",
                        type: "u64",
                    },
                    {
                        name: "name",
                        type: "string",
                    },
                    {
                        name: "region",
                        type: {
                            array: ["u8", 3],
                        },
                    },
                    {
                        name: "geohash",
                        type: {
                            array: ["u8", 6],
                        },
                    },
                    {
                        name: "uri",
                        type: "string",
                    },
                    {
                        name: "owner",
                        type: "publicKey",
                    },
                    {
                        name: "bump",
                        type: "u8",
                    },
                ],
            },
        },
        {
            name: "user",
            type: {
                kind: "struct",
                fields: [
                    {
                        name: "region",
                        type: {
                            array: ["u8", 3],
                        },
                    },
                    {
                        name: "uri",
                        type: "string",
                    },
                    {
                        name: "bump",
                        type: "u8",
                    },
                ],
            },
        },
    ],
};
