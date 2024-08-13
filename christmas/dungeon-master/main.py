from redis import Redis
from dotenv import load_dotenv, find_dotenv
import os
from dataclasses import dataclass
from time import time
import logging
import asyncio
from asyncio import Queue
from typing import Dict, List, Any, Set
from dm.game import Game
from dm.types import Monster, Player
from dm.world.bestiary import bestiary
from dm.world.abilities import abilities
from dm.utils import entity_in_range

logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("main")

load_dotenv(find_dotenv())
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT")
REDIS_USERNAME = os.getenv("REDIS_USERNAME")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
API_HOST = os.getenv("API_HOST")
DUNGEON_MASTER_TOKEN = os.getenv("DUNGEON_MASTER_TOKEN")


@dataclass
class Context:
    game: Game
    jobs: Queue[Any]
    monsters_by_id: Dict[str, Monster]
    players_by_id: Dict[str, Player]
    monsters_near_players: Dict[str, List[str]]
    dirty_entities: Set[str]


async def process_entities(context: Context):
    """
    Reformat or bin entities as neccessary or use monsters_near_players
    - Use monsters_by_id, players_by_id to get the actual entity data
    """
    processed = 0
    monsters_processed = set()
    for p, mx in context.monsters_near_players.items():
        processed += 1

        # Refetch player if dirty
        if p in context.dirty_entities:
            context.players_by_id[p] = context.game.fetch_entity(p)
            context.dirty_entities.remove(p)

        for m in mx:

            # Monster already processed
            if m in monsters_processed:
                continue
            monsters_processed.add(m)

            # Refetch monster if dirty
            if m in context.dirty_entities:
                context.monsters_by_id[m] = context.game.fetch_entity(m)
                context.dirty_entities.remove(m)

            # Choose monster ability
            monster = context.monsters_by_id[m]
            beast = bestiary[monster["beast"]]
            ability_str = beast["abilities"]["offensive"][0]
            ability = abilities[ability_str]

            # Check player in range of ability
            player = context.players_by_id[p]
            in_range, distance = entity_in_range(monster, player, ability["range"])
            if in_range:
                # Perform ability
                await context.jobs.put(["perform_monster_ability", m, p, ability_str])
            else:
                # Move in range
                await context.jobs.put(["perform_monster_move", m, player["loc"][0]])

        if processed % 50 == 0:
            logging.info(f"{processed}/{len(context.players_by_id)} players processed")


async def spawn_monsters(
    monsters_by_id: Dict[str, Monster], players_by_id: Dict[str, Player]
):
    """
    Determine when and where to spawn new monsters as players explore
    - Should also take into account not spawning immediately when the player comes back to the area
    """
    pass


async def update_entities_record_loop(context: Context, interval: int):
    while True:
        now = time()
        for player in context.game.logged_in_players():
            if player["locT"] != "geohash":
                continue
            player_geohash = player["loc"][0]
            context.players_by_id[player["player"]] = player
            context.monsters_near_players[player["player"]] = []
            for monster in context.game.get_nearby_entities(
                player_geohash, monsters=True
            ):
                context.monsters_by_id[monster["monster"]] = monster
                context.monsters_near_players[player["player"]].append(
                    monster["monster"]
                )
        took = time() - now
        logger.info(f"Update entities took {took:.1f} seconds")

        remaining = interval - took
        if remaining > 0:
            await asyncio.sleep(remaining)


async def spawn_monsters_loop(context: Context, interval: int):
    while True:
        now = time()
        await spawn_monsters(
            monsters_by_id=context.monsters_by_id,
            players_by_id=context.players_by_id,
        )
        took = time() - now
        logger.info(f"Spawn monsters took {took:.1f} seconds")

        remaining = interval - took
        if remaining > 0:
            await asyncio.sleep(remaining)


async def process_entities_loop(context: Context, interval: int):
    while True:
        now = time()
        await process_entities(context)
        took = time() - now
        logger.info(
            f"Processed {len(context.players_by_id)} players {len(context.monsters_by_id)} monsters in {took:.1f} seconds"
        )
        remaining = interval - took
        if remaining > 0:
            await asyncio.sleep(remaining)


async def process_jobs_loop(context: Context):
    while True:
        job = await context.jobs.get()
        if job:
            job_type, *args = job
            if job_type == "perform_monster_ability":
                monster_id, player_id, ability_str = args

                # FOR TESTING
                if (
                    player_id != "9WQYjAQUcwFwE6oBuTdjKzT9VSHzN5yZVK8RcReJ5A4v"
                    or monster_id != "monster_goblin10620"
                ):
                    continue

                if (
                    monster_id in context.monsters_by_id
                    and player_id in context.players_by_id
                ):
                    print(job)
                    await context.game.perform_monster_ability(
                        monster=context.monsters_by_id[monster_id],
                        player=context.players_by_id[player_id],
                        ability_str=ability_str,
                    )
                    context.dirty_entities.add(monster_id)  # set dirty
                    context.dirty_entities.add(player_id)  # set dirty

            elif job_type == "perform_monster_move":
                monster_id, target_geohash = args

                # FOR TESTING
                if monster_id != "monster_goblin10620":
                    continue

                if monster_id in context.monsters_by_id:
                    print(job)
                    await context.game.perform_monster_move(
                        monster=context.monsters_by_id[monster_id],
                        geohash=target_geohash,
                    )
                    context.dirty_entities.add(monster_id)  # set dirty
            # Mark job as done
            context.jobs.task_done()


async def main():

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
    dirty_entities = set()

    # Job queue
    jobs: Queue[Any] = Queue()

    context = Context(
        game=game,
        jobs=jobs,
        monsters_by_id=monsters_by_id,
        players_by_id=players_by_id,
        monsters_near_players=monsters_near_players,
        dirty_entities=dirty_entities,
    )

    # Create tasks for each loop
    update_task = asyncio.create_task(
        update_entities_record_loop(
            context,
            interval=10,
        )
    )
    spawn_task = asyncio.create_task(spawn_monsters_loop(context, interval=30))
    process_task = asyncio.create_task(process_entities_loop(context, interval=3))
    job_task = asyncio.create_task(process_jobs_loop(context))

    # Run tasks
    await asyncio.gather(update_task, spawn_task, process_task, job_task)


if __name__ == "__main__":
    asyncio.run(main())
