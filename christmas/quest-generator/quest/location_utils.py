import geohash2
from typing import List


def decode_geohash(geohash: str) -> tuple:
    return geohash2.decode(geohash)


def get_location_info(geohash: str) -> dict:
    lat, lon = decode_geohash(geohash)
    name = f"Location at {lat:.2f}, {lon:.2f}"
    return {
        "name": name,
        "description": f"A location near {get_nearest_landmark(lat, lon)}",
        "nearby_locations": get_nearby_location_names(geohash),
    }


def get_nearest_landmark(lat: float, lon: float) -> str:
    # Implement based on your game's geography
    return "Some Landmark"


def get_nearby_location_names(geohash: str) -> List[str]:
    # Implement based on your game's geography
    return ["Nearby Location 1", "Nearby Location 2"]


def get_distance_between_locations(loc1: str, loc2: str) -> float:
    # Implement based on your game's geography
    return 0.0
