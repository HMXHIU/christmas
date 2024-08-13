from redis import Redis
from dotenv import load_dotenv, find_dotenv
import os
from time import sleep, time
import logging
import sched
from typing import Dict, List
from dm.game import Game
from dm.types import Monster, Player
from dm.world.bestiary import bestiary
from dm.world.abilities import abilities
from dm.utils import entity_in_range

logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("main")
scheduler = sched.scheduler(time, sleep)

load_dotenv(find_dotenv())
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT")
REDIS_USERNAME = os.getenv("REDIS_USERNAME")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
API_HOST = os.getenv("API_HOST")
DUNGEON_MASTER_TOKEN = os.getenv("DUNGEON_MASTER_TOKEN")


# Connect to redis
redis_client = Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    username=REDIS_USERNAME,
    password=REDIS_PASSWORD,
    db=0,
    protocol=3,
    decode_responses=True,
)

# Create game client
game = Game(redis_client, 200, dm_token=DUNGEON_MASTER_TOKEN, api_host=API_HOST)

# Entity records
monsters_by_id: Dict[str, Monster] = {}
players_by_id: Dict[str, Player] = {}
monsters_near_players: Dict[str, List[str]] = {}


def process_entities(
    monsters_by_id: Dict[str, Monster],
    players_by_id: Dict[str, Player],
    monsters_near_players: Dict[str, List[str]],
):
    """
    Reformat or bin entities as neccessary or use monsters_near_players
    - Use monsters_by_id, players_by_id to get the actual entity data
    """
    processed = 0
    monsters_processed = set()
    for p, mx in monsters_near_players.items():
        processed += 1
        for m in mx:

            # monster already processed
            if m in monsters_processed:
                continue
            monsters_processed.add(m)

            # Choose monster ability
            monster = monsters_by_id[m]
            beast = bestiary[monster["beast"]]
            ability_str = beast["abilities"]["offensive"][0]
            ability = abilities[ability_str]

            # Check player in range of ability
            player = players_by_id[p]

            if entity_in_range(monster, player, ability["range"]):
                # use ability
                game.perform_monster_ability(
                    monster=monster, player=player, ability_str=ability_str
                )
            else:
                # move in range
                game.perform_monster_move(monster=monster, geohash=player["loc"][0])

        if processed % 20 == 0:
            logging.info(f"{processed} players processed")


def spawn_monsters(
    monsters_by_id: Dict[str, Monster], players_by_id: Dict[str, Player]
):
    """
    Determine when and where to spawn new monsters as players explore
    - Should also take into account not spawning immediately when the player comes back to the area
    """
    pass


def update_entities_record_loop(interval: int):
    now = time()
    for player in game.logged_in_players():
        if player["locT"] != "geohash":
            continue
        player_geohash = player["loc"][0]
        players_by_id[player["player"]] = player  # update players
        monsters_near_players[player["player"]] = []
        # TODO: this can be more efficient by first getting all unique player's geohash
        for monster in game.get_nearby_entities(player_geohash, monsters=True):
            monsters_by_id[monster["monster"]] = monster  # update monsters
            monsters_near_players[player["player"]].append(monster["monster"])
    took = time() - now
    logger.info(f"Update entities took {took:.1f} seconds")

    # schedule next call
    scheduler.enter(interval, 1, update_entities_record_loop, (interval,))


def spawn_monsters_loop(
    interval: int, monsters_by_id: Dict[str, Monster], players_by_id: Dict[str, Player]
):
    now = time()
    spawn_monsters(monsters_by_id=monsters_by_id, players_by_id=players_by_id)
    took = time() - now
    logger.info(f"Spawn monsters took {took:.1f} seconds")

    # schedule next call
    scheduler.enter(
        interval,
        1,
        spawn_monsters_loop,
        (
            interval,
            monsters_by_id,
            players_by_id,
        ),
    )


def process_entities_loop(
    interval: int,
    monsters_by_id: Dict[str, Monster],
    players_by_id: Dict[str, Player],
    monsters_near_players: Dict[str, List[str]],
):
    now = time()
    process_entities(
        monsters_by_id=monsters_by_id,
        players_by_id=players_by_id,
        monsters_near_players=monsters_near_players,
    )
    took = time() - now
    logger.info(
        f"Processed {len(players_by_id)} players {len(monsters_by_id)} monsters in {took:.1f} seconds"
    )

    # schedule next call
    scheduler.enter(
        interval,
        1,
        process_entities_loop,
        (
            interval,
            monsters_by_id,
            players_by_id,
            monsters_near_players,
        ),
    )


if __name__ == "__main__":
    update_entities_record_loop(interval=10)
    spawn_monsters_loop(
        interval=30, monsters_by_id=monsters_by_id, players_by_id=players_by_id
    )
    process_entities_loop(
        interval=3,
        monsters_by_id=monsters_by_id,
        players_by_id=players_by_id,
        monsters_near_players=monsters_near_players,
    )
    scheduler.run()
