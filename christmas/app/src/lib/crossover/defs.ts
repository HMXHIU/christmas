import { PUBLIC_GAME_BUCKET, PUBLIC_MINIO_ENDPOINT } from "$env/static/public";

export {
    GAME_MORPHOLOGY,
    GAME_MORPHOLOGY_IMAGES,
    GAME_PREFIX,
    GAME_SANCTUARIES,
    GAME_TEXTURES,
    GAME_TILEMAPS,
    GAME_TOPOLOGY,
    GAME_TOPOLOGY_IMAGES,
    GAME_WORLDS,
};

// Game bucket paths
const GAME_PREFIX = `${PUBLIC_MINIO_ENDPOINT}/${PUBLIC_GAME_BUCKET}`;
const GAME_TILEMAPS = `${GAME_PREFIX}/worlds/tilemaps`;
const GAME_WORLDS = `${GAME_PREFIX}/worlds`;
const GAME_MORPHOLOGY = `${GAME_PREFIX}/avatar/morphology`;
const GAME_MORPHOLOGY_IMAGES = `${GAME_PREFIX}/avatar/morphology/images`;
const GAME_TOPOLOGY = `${GAME_PREFIX}/topology`;
const GAME_TOPOLOGY_IMAGES = `${GAME_PREFIX}/topology/topology_2p`;
const GAME_TEXTURES = `${GAME_PREFIX}/sprites/textures`;
const GAME_SANCTUARIES = `${GAME_PREFIX}/sanctuaries`;
