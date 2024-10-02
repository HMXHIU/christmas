import { Repository } from "redis-om";
import {
    CouponAccountEntitySchema,
    CouponEntitySchema,
    StoreEntitySchema,
} from "./schema";

// Exports
export {
    couponAccountRepository,
    couponRepository,
    initializeCommunityRedisRepositories,
    storeRepository,
};

// Repositories
let storeRepository: Repository;
let couponRepository: Repository;
let couponAccountRepository: Repository;

async function initializeCommunityRedisRepositories(redisClient: any) {
    // Register Schemas
    registerSchemas(redisClient);

    // Create Indexes
    await createIndexes();
}

function registerSchemas(redisClient: any) {
    console.info("Registering community redis schemas");
    storeRepository = new Repository(StoreEntitySchema, redisClient);
    couponRepository = new Repository(CouponEntitySchema, redisClient);
    couponAccountRepository = new Repository(
        CouponAccountEntitySchema,
        redisClient,
    );
}

async function createIndexes() {
    console.info("Creating indexes for community redis schemas");
    await storeRepository.createIndex();
    await couponRepository.createIndex();
    await couponAccountRepository.createIndex();
}
