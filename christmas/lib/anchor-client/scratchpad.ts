import { DAYS_SINCE_1_JAN_2024, MS_PER_DAY } from "./defs";
import { epochDaysFromDate, u8ToByteMask } from "./utils";

import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

console.log("#####################");

// [
//   {
//     memcmp: {
//       offset: 401,
//       bytes: "1111111111111111",
//     },
//   },
//   {
//     memcmp: {
//       offset: 417,
//       bytes: "8AQGAut7N92awznwCnjuQ",
//     },
//   },
// ];

// const today = new Date().getTime();

// const januaryFirst2024 = new Date(2024, 0, 1);

// Math.floor(new Date(2024, 0, 1).getTime() / MS_PER_DAY)

// // Get the date in milliseconds
// const milliseconds = januaryFirst2024.getTime();

// console.log(
//     "DAYS_SINCE_1_JAN_2024",
//     Math.floor(milliseconds / MS_PER_DAY),
//     "vs",
//     DAYS_SINCE_1_JAN_2024
// );

// console.log(
//     "days since",
//     Math.floor(today / MS_PER_DAY) - DAYS_SINCE_1_JAN_2024
// );

// console.log("epochDaysFromDate", epochDaysFromDate(today));
// console.log(u8ToByteMask(8));

// validFrom
// [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] 16
console.log(
    Uint8Array.from(Buffer.from(bs58.decode("11111111111111111111111111111")))
);

// validTo 15
// [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]
console.log(Uint8Array.from(Buffer.from(bs58.decode("LUv"))));

// anchorClient.ts:499 [
//     {
//       "memcmp": {
//         "offset": 388,
//         "bytes": "11111111111111111111111111111"
//       }
//     },
//     {
//       "memcmp": {
//         "offset": 417,
//         "bytes": "LUv"
//       }
//     }
//   ]
//   anchorClient.ts:500

//   anchorClient.ts:498

//   anchorClient.ts:499 [
//     {
//       "memcmp": {
//         "offset": 449,
//         "bytes": "2"
//       }
//     },
//     {
//       "memcmp": {
//         "offset": 417,
//         "bytes": "LUv"
//       }
//     }
//   ]
//   anchorClient.ts:500

//   anchorClient.ts:498

//   anchorClient.ts:499 [
//     {
//       "memcmp": {
//         "offset": 449,
//         "bytes": "2"
//       }
//     },
//     {
//       "memcmp": {
//         "offset": 388,
//         "bytes": "11111111111111111111111111111"
//       }
//     }
//   ]

// -3 months today + 3 months

// "validFromHash": [
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     128,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0
//   ],
//   "validToHash": [
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     255,
//     252,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0,
//     0
//   ],
//   "datehashOverflow": true,

console.log("#####################");
