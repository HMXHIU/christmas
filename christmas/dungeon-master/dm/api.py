import aiohttp
from typing import List
from .pathfinding import Direction


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
