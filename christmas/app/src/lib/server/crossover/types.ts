import type {
    Dialogue,
    Item,
    Monster,
    Player,
    World,
} from "$lib/crossover/types";
import type { Entity } from "redis-om";

export type {
    ActorEntity,
    CreatureEntity,
    DialogueEntity,
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
    WorldEntity,
};

type ActorEntity = MonsterEntity | PlayerEntity | ItemEntity;
type PlayerEntity = Player & Entity;
type MonsterEntity = Monster & Entity;
type CreatureEntity = PlayerEntity | MonsterEntity;
type ItemEntity = Item & Entity;
type WorldEntity = World & Entity;
type DialogueEntity = Dialogue & Entity;
