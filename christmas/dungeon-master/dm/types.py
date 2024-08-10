from typing import Union, Literal, TypedDict, List

EntityType = Literal["player", "monster", "item"]
LocationType = Literal["geohash", "inv"]


class Player(TypedDict):
    player: str
    locT: LocationType
    loc: List[str]


class Monster(TypedDict):
    monster: str
    beast: str
    locT: LocationType
    loc: List[str]


class Item(TypedDict):
    item: str
    prop: str
    locT: LocationType
    loc: List[str]


Entity = Union[Player, Monster, Item]
