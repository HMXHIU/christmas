import type {
    Dialogue,
    Item,
    Monster,
    Player,
    World,
} from "$lib/crossover/types";
import type { Entity } from "redis-om";

export type {
    DialogueEntity,
    GameRedisEntities,
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
    WorldEntity,
};

type GameRedisEntities = MonsterEntity | PlayerEntity | ItemEntity;
type PlayerEntity = Player & Entity;
type MonsterEntity = Monster & Entity;
type ItemEntity = Item & Entity;
type WorldEntity = World & Entity;
type DialogueEntity = Dialogue & Entity;
