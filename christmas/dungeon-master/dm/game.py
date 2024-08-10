from redis.commands.search.query import Query
import json
from typing import Generator
from .utils import geohashes_nearby
from .queries import (
    players_in_geohash_query,
    logged_in_players_query,
    items_in_geohash_query,
    monsters_in_geohash_query,
)
from .types import Player, Entity, Monster
from .world.abilities import abilities, Ability
from .utils import entity_in_range, geohash_to_grid_cell
from .pathfinding import a_star_pathfinding
from requests import request


class Game:

    def __init__(self, redis_client, page_size=10, dm_token="", api_host="") -> None:
        self.redis_client = redis_client
        self.page_size = page_size
        self.player_index = redis_client.ft("Player:index")
        self.monster_index = redis_client.ft("Monster:index")
        self.item_index = redis_client.ft("Item:index")
        self.world_index = redis_client.ft("World:index")
        self.dm_token = dm_token
        self.api_host = api_host

    def logged_in_players(self, offset=0) -> Generator[Player, None, None]:
        # This is a generator
        return index_query_generator(
            self.player_index, logged_in_players_query(), self.page_size, offset
        )

    def fetch_entity(self, entity_id) -> Entity:
        if entity_id.startswith("monster"):
            return self.redis_client.json().get(f"Monster:{entity_id}")
        elif entity_id.startswith("item"):
            return self.redis_client.json().get(f"Item:{entity_id}")
        else:
            return self.redis_client.json().get(f"Player:{entity_id}")

    def get_nearby_entities(self, geohash, **kwargs) -> Generator[Entity, None, None]:
        # This is a generator
        monsters = kwargs["monsters"] if "monsters" in kwargs else False
        players = kwargs["players"] if "players" in kwargs else False
        items = kwargs["items"] if "items" in kwargs else False
        zoom = kwargs["zoom"] if "zoom" in kwargs else -2  # default to 6 precision zoom

        if monsters and players and items:
            raise Exception("Choose only a single entity type to query")

        p6 = geohash[:zoom]
        nearby_geohashes = geohashes_nearby(p6)

        if players:
            return index_query_generator(
                self.player_index,
                players_in_geohash_query(nearby_geohashes),
                self.page_size,
            )

        if monsters:
            return index_query_generator(
                self.monster_index,
                monsters_in_geohash_query(nearby_geohashes),
                self.page_size,
            )

        if items:
            return index_query_generator(
                self.item_index,
                items_in_geohash_query(nearby_geohashes),
                self.page_size,
            )

        raise Exception("Query either players, monsters or items")

    def get_nearby_player_ids(self, geohash):
        players = self.get_nearby_entities(
            geohash,
            self.page_size,
            {"players": True, "monsters": False, "items": False},
        )["players"]
        return [player.player for player in players]

    def has_colliders_in_geohash(self, geohash):
        item_colliders = self.item_index.search(
            Query(f"@locT:{{geohash}} @loc:{{{geohash}*}} @cld:{{true}}")
        ).total
        world_colliders = self.world_index.search(Query(f"@cld:{{{geohash}*}}")).total
        return (item_colliders + world_colliders) > 0

    def perform_monster_ability(self, monster: Monster, player: Player, ability: str):

        ability: Ability = abilities[ability]

        # check in range
        in_range, distance = entity_in_range(monster, player, ability["range"])

        if in_range:
            # call API to perform ability
            pass

        pass

    def perform_monster_move(self, monster: Monster, **kwargs):

        geohash = kwargs["geohash"] if "geohash" in kwargs else None
        directions = kwargs["directions"] if "directions" in kwargs else None

        if geohash != None:
            monster_geohash = monster["loc"][0]
            monster_cell = geohash_to_grid_cell(monster_geohash)
            dest_cell = geohash_to_grid_cell(geohash)

            directions = a_star_pathfinding(
                monster_cell["row"],
                monster_cell["col"],
                dest_cell["row"],
                dest_cell["col"],
                lambda r, c: 0,  # TODO: need to check for colliders
            )
        elif directions == None:
            raise Exception("Provide either geohash or directions")

        request(
            "POST",
            f"{self.api_host}/trpc/crossover.dm.moveMonster",
            headers={
                "Authorization": f"Bearer {self.dm_token}",
            },
            json={"path": directions, "entity": monster["monster"]},
        )


def index_query_generator(index, query, page_size, offset=0):
    offset = 0
    while True:
        entities = map(
            format_doc,
            index.search(query.paging(offset, page_size))["results"],
        )

        entity_count = 0
        for entity in entities:
            yield entity
            entity_count += 1

        if entity_count < page_size:
            break

        offset += entity_count


def format_doc(entry):
    return json.loads(entry["extra_attributes"]["$"])
