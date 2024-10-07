from typing import Union, Literal, TypedDict, List, Dict

EntityType = Literal["player", "monster", "item"]
LocationType = Literal["geohash", "inv"]


class Player(TypedDict):
    player: str
    locT: LocationType
    loc: List[str]
    skills: Dict[str, int]


class Monster(TypedDict):
    monster: str
    beast: str
    locT: LocationType
    loc: List[str]
    skills: Dict[str, int]


class Item(TypedDict):
    item: str
    prop: str
    locT: LocationType
    loc: List[str]


Entity = Union[Player, Monster, Item]
