from requests import request
from typing import List
from .pathfinding import Direction


class APIClient:

    def __init__(self, api_host: str, dm_token: str) -> None:
        self.api_host = api_host
        self.dm_token = dm_token

    def monster_move(self, monster: str, directions: List[Direction]):
        request(
            "POST",
            f"{self.api_host}/trpc/crossover.dm.moveMonster",
            headers={
                "Authorization": f"Bearer {self.dm_token}",
            },
            json={"path": directions, "entity": monster},
        ).raise_for_status()

    def monster_ability(self, monster: str, target: str, ability: str):
        request(
            "POST",
            f"{self.api_host}/trpc/crossover.dm.performMonsterAbility",
            headers={
                "Authorization": f"Bearer {self.dm_token}",
            },
            json={"ability": ability, "entity": monster, "target": target},
        ).raise_for_status()
