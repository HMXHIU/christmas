from typing import TypedDict, Dict


class SpatialPrecision(TypedDict):
    precision: float


class ContinentSeed(TypedDict):
    bio: float
    hostile: float
    water: float


class WorldSeedConstants(TypedDict):
    maxMonstersPerContinent: int


class WorldSeedSpatial(TypedDict):
    continent: SpatialPrecision
    territory: SpatialPrecision
    guild: SpatialPrecision
    city: SpatialPrecision
    town: SpatialPrecision
    village: SpatialPrecision
    house: SpatialPrecision
    unit: SpatialPrecision


class WorldSeedSeeds(TypedDict):
    continent: Dict[str, ContinentSeed]


class WorldSeed(TypedDict):
    name: str
    description: str
    constants: WorldSeedConstants
    spatial: WorldSeedSpatial
    seeds: WorldSeedSeeds


world_seed: WorldSeed = {
    "name": "yggdrasil 01",
    "description": "The beginning",
    "spatial": {
        "continent": {"precision": 1},  # geohash precision
        "territory": {"precision": 2},
        "guild": {"precision": 3},
        "city": {"precision": 4},
        "town": {"precision": 5},
        "village": {"precision": 6},
        "house": {"precision": 7},
        "unit": {"precision": 8},
    },
    "constants": {
        "maxMonstersPerContinent": 10_000_000_000,  # 10 billion
    },
    "seeds": {
        "continent": {
            "b": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "c": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "f": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "g": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "u": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "v": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "y": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "z": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "8": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "9": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "d": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "e": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "s": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "t": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "w": {"bio": 0.5, "hostile": 0.2, "water": 0.0},  # no water for testing
            "x": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "2": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "3": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "6": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "7": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "k": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "m": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "q": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "r": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "0": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "1": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "4": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "5": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "h": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "j": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "n": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
            "p": {"bio": 0.5, "hostile": 0.2, "water": 0.1},
        },
    },
}
