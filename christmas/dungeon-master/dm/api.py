import aiohttp
from typing import List, Dict, Tuple
from .pathfinding import Direction
from async_lru import alru_cache


class APIClient:
    def __init__(self, api_host: str, dm_token: str) -> None:
        self.api_host = api_host
        self.dm_token = dm_token
        self.session = aiohttp.ClientSession()

    async def close(self):
        if self.session:
            await self.session.close()

    async def monster_move(self, monster: str, directions: List[Direction]):
        async with self.session.post(
            f"{self.api_host}/trpc/crossover.dm.moveMonster",
            headers={
                "Authorization": f"Bearer {self.dm_token}",
            },
            json={"path": directions, "entity": monster},
        ) as response:
            response.raise_for_status()

    async def monster_ability(self, monster: str, target: str, ability: str):
        async with self.session.post(
            f"{self.api_host}/trpc/crossover.dm.performMonsterAbility",
            headers={
                "Authorization": f"Bearer {self.dm_token}",
            },
            json={"ability": ability, "entity": monster, "target": target},
        ) as response:
            response.raise_for_status()

    async def monster_attack(self, monster: str, target: str):
        async with self.session.post(
            f"{self.api_host}/trpc/crossover.dm.performMonsterAttack",
            headers={
                "Authorization": f"Bearer {self.dm_token}",
            },
            json={"entity": monster, "target": target},
        ) as response:
            response.raise_for_status()

    async def respawn_monsters(self):
        async with self.session.post(
            f"{self.api_host}/trpc/crossover.dm.respawnMonsters",
            headers={
                "Authorization": f"Bearer {self.dm_token}",
            },
            json={},
        ) as response:
            response.raise_for_status()

    @alru_cache(maxsize=128)
    async def monster_abilities(self, skills: Tuple[Tuple[str, int]]) -> List[str]:
        async with self.session.post(
            f"{self.api_host}/trpc/crossover.dm.monsterAbilities",
            headers={
                "Authorization": f"Bearer {self.dm_token}",
            },
            json=dict(skills),
        ) as response:
            response.raise_for_status()
            return (await response.json())["result"]["data"]
