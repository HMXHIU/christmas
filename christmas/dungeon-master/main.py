from redis import Redis
from dotenv import load_dotenv, find_dotenv
import os
from dataclasses import dataclass
from time import time
import logging
import asyncio
from asyncio import Queue
import traceback
from typing import Dict, List, Any, Set, Tuple
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

            # Determine if monster should attack, move, perform ability
            monster_action = await determine_monster_action(
                context.monsters_by_id[m], context.players_by_id[p], context
            )
            if monster_action:
                await context.jobs.put(monster_action)

        if processed % 50 == 0:
            logging.info(f"{processed}/{len(context.players_by_id)} players processed")


async def determine_monster_action(
    monster: Monster, player: Player, context: Context
) -> Tuple | None:

    # Don't do anything if range > 5
    in_range, distance = entity_in_range(monster, player, 5)
    if not in_range:
        return None

    # # Query monster abilities
    # monster_abilities = await context.game.query_monster_abilities(monster)

    # # Try to find offensive ability in range
    # offensive_abilities = [
    #     a for a in monster_abilities if abilities[a]["type"] == "offensive"
    # ]
    # for a in offensive_abilities:
    #     ability = abilities[a]
    #     # Check player in range of ability
    #     if distance <= ability["range"]:
    #         return [
    #             "perform_monster_ability",
    #             monster["monster"],
    #             player["player"],
    #             ability["ability"],
    #         ]

    # Try to attack (attack range is 1)
    if distance <= 1:
        return ["perform_monster_attack", monster["monster"], player["player"]]

    # Move in range
    return ["perform_monster_move", monster["monster"], player["loc"][0]]


async def update_entities_record_loop(context: Context, interval: int):
    while True:
        now = time()

        # clear context
        context.players_by_id.clear()
        context.monsters_by_id.clear()
        context.monsters_near_players.clear()
        context.dirty_entities = set()

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
        await context.game.api_client.respawn_monsters()
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


async def process_job(context: Context, job: Tuple):

    job_type, *args = job

    if job_type == "perform_monster_ability":
        monster_id, player_id, ability_str = args
        if monster_id in context.monsters_by_id and player_id in context.players_by_id:
            await context.game.perform_monster_ability(
                monster=context.monsters_by_id[monster_id],
                player=context.players_by_id[player_id],
                ability_str=ability_str,
            )
            context.dirty_entities.add(monster_id)
            context.dirty_entities.add(player_id)
            # logger.debug(f"{monster_id} perform {ability_str} on {player_id}")

    elif job_type == "perform_monster_attack":
        monster_id, player_id = args
        if monster_id in context.monsters_by_id and player_id in context.players_by_id:
            await context.game.perform_monster_attack(
                monster=context.monsters_by_id[monster_id],
                player=context.players_by_id[player_id],
            )
            context.dirty_entities.add(monster_id)
            context.dirty_entities.add(player_id)
            # logger.debug(f"{monster_id} attack {player_id}")

    elif job_type == "perform_monster_move":
        monster_id, target_geohash = args
        if monster_id in context.monsters_by_id:
            await context.game.perform_monster_move(
                monster=context.monsters_by_id[monster_id],
                geohash=target_geohash,
            )
            context.dirty_entities.add(monster_id)
            # logger.debug(f"{monster_id} move to {target_geohash}")


async def process_jobs_loop(context: Context):
    while True:
        try:
            # Collect a batch of jobs
            jobs: List[Tuple] = []
            for _ in range(500):  # Adjust the batch size as needed
                try:
                    job = context.jobs.get_nowait()
                    jobs.append(job)
                except asyncio.QueueEmpty:
                    break

            if not jobs:
                # If no jobs, wait a bit before checking again
                await asyncio.sleep(0.1)
                continue

            # Process the batch of jobs concurrently
            await asyncio.gather(*[process_job(context, job) for job in jobs])

            logger.debug(f"Processed {len(jobs)}/{context.jobs.qsize()} jobs")

            # Mark all processed jobs as done
            for _ in jobs:
                context.jobs.task_done()

        except Exception as e:
            logger.error(f"Error in process_jobs_loop: {e}")
            logger.error(traceback.format_exc())


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
    spawn_task = asyncio.create_task(spawn_monsters_loop(context, interval=60 * 60))
    process_task = asyncio.create_task(process_entities_loop(context, interval=7))
    job_task = asyncio.create_task(process_jobs_loop(context))

    # Run tasks
    await asyncio.gather(update_task, spawn_task, process_task, job_task)


if __name__ == "__main__":
    asyncio.run(main())
