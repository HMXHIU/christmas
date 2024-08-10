import geohash
import math
from typing import Tuple, TypedDict
from .types import Entity, EntityType


class GridCell(TypedDict):
    precision: int
    row: int
    col: int
    geohash: str


def geohashes_nearby(geohash_str) -> list[str]:
    return [geohash_str, *geohash.neighbors(geohash_str)]


def geohash_to_col_row(geohash_str: str) -> Tuple[int, int]:
    precision = len(geohash_str)
    if precision == 1:
        return even_col_row[geohash_str]
    xp, yp = geohash_to_col_row(geohash_str[:-1])
    if (precision - 1) % 2 == 0:
        x, y = even_col_row[geohash_str[-1]]
        return x + xp * 8, y + yp * 4
    else:
        x, y = odd_col_row[geohash_str[-1]]
        return x + xp * 4, y + yp * 8


def geohash_to_grid_cell(geohash_str: str) -> GridCell:
    """
    Gets the grid cell coordinates for a given geohash.

    Args:
        geohash (str): The geohash string.

    Returns:
        {row, col, precision, geohash}
    """
    precision = len(geohash_str)
    col, row = geohash_to_col_row(geohash_str)
    return {"precision": precision, "row": row, "col": col, "geohash": geohash_str}


def entity_in_range(
    source: Entity, target: Entity, range: int, diagonal: bool = True
) -> Tuple[bool, int]:
    """
    Check if a target entity is within range of the source entity.

    Args:
        source (Union[Player, Monster]): The source entity.
        target (Union[Player, Monster, Item]): The target entity.
        range (int): The maximum range to check.
        diagonal (bool, optional): Whether to use diagonal distance. Defaults to True.

    Returns:
        Tuple[bool, int]: A tuple containing:
            - A boolean indicating whether the target is in range
            - The calculated distance
    """
    # If the target is not a geohash, check if the target is on source
    if target["locT"] != "geohash":
        # Allow targeting items on source
        if target["loc"][0] == get_entity_id(source):
            return True, 0
        # Not allowed to target items on other entities
        else:
            return False, 0

    source_cell = geohash_to_grid_cell(source["loc"][0]).values()
    target_cell = geohash_to_grid_cell(target["loc"][0]).values()

    return in_range(
        {
            "r1": source_cell["row"],
            "c1": source_cell["col"],
            "r2": target_cell["row"],
            "c2": target_cell["col"],
            "range": range,
            "diagonal": diagonal,
        }
    )


def in_range(
    r1,
    c1,
    r2,
    c2,
    range,
    diagonal,
):
    """
    Determines if two points are within a specified range.

    Args:
        r1 (int): Row of the first point
        c1 (int): Column of the first point
        r2 (int): Row of the second point
        c2 (int): Column of the second point
        range (int): The range to check
        diagonal (bool, optional): Whether to use diagonal distance. Defaults to False.

    Returns:
        Tuple[bool, int]: A tuple containing:
            - A boolean indicating whether the points are in range
            - The calculated distance (Chebyshev distance for diagonal, squared Euclidean distance otherwise)
    """

    if diagonal:
        delta_x = abs(r1 - r2)
        delta_y = abs(c1 - c2)
        chebyshev_distance = max(delta_x, delta_y)
        return range < 0 or chebyshev_distance <= range, delta_x + delta_y
    else:
        delta_x = r1 - r2
        delta_y = c1 - c2
        squared_distance = delta_x * delta_x + delta_y * delta_y
        squared_range = range * range
        return range < 0 or squared_distance <= squared_range, squared_distance


grid_size_at_precision = {
    1: {"rows": 4, "cols": 8},
    2: {"rows": 4 * 8, "cols": 8 * 4},
    3: {"rows": 4 * 8 * 4, "cols": 8 * 4 * 8},
    4: {"rows": 4 * 8 * 4 * 8, "cols": 8 * 4 * 8 * 4},
    5: {"rows": 4 * 8 * 4 * 8 * 4, "cols": 8 * 4 * 8 * 4 * 8},
    6: {"rows": 4 * 8 * 4 * 8 * 4 * 8, "cols": 8 * 4 * 8 * 4 * 8 * 4},
    7: {"rows": 4 * 8 * 4 * 8 * 4 * 8 * 4, "cols": 8 * 4 * 8 * 4 * 8 * 4 * 8},
    8: {
        "rows": 4 * 8 * 4 * 8 * 4 * 8 * 4 * 8,
        "cols": 8 * 4 * 8 * 4 * 8 * 4 * 8 * 4,
    },
    9: {
        "rows": 4 * 8 * 4 * 8 * 4 * 8 * 4 * 8 * 4,
        "cols": 8 * 4 * 8 * 4 * 8 * 4 * 8 * 4 * 8,
    },
}


def get_entity_id(entity: Entity) -> Tuple[str, EntityType]:
    """
    Get the ID and type of an entity.

    Args:
        entity (Union[Player, Monster, Item]): The entity to identify.

    Returns:
        Tuple[str, EntityType]: A tuple containing:
            - The entity's ID as a string
            - The entity's type as a literal "player", "monster", or "item"

    Raises:
        ValueError: If the entity type cannot be determined.
    """
    if "player" in entity:
        return entity["player"], "player"
    elif "monster" in entity:
        return entity["monster"], "monster"
    elif "item" in entity:
        return entity["item"], "item"


def string_to_random_number(s: str) -> int:
    """
    Converts a string (seed) to a random number.

    Args:
        s (str): The string to convert.

    Returns:
        int: The random number generated from the string (seed).
    """
    hash_value = 0
    if len(s) == 0:
        return hash_value
    for char in s:
        hash_value = ((hash_value << 5) - hash_value + ord(char)) & 0xFFFFFFFF
        hash_value = hash_value | 0  # Ensure 32-bit integer behavior
    return (
        hash_value if hash_value >= 0 else ~hash_value + 1
    )  # Two's complement for negative numbers


def seeded_random(seed: float) -> float:
    """
    Generates a seeded random number between 0 and 1.

    Args:
        seed (float): The seed value used to generate the random number.

    Returns:
        float: A random number between 0 (inclusive) and 1 (exclusive).
    """
    x = math.sin(seed) * 10000  # how many decimal places
    return x - math.floor(x)


even_col_row = {
    "b": (0, 0),
    "c": (1, 0),
    "f": (2, 0),
    "g": (3, 0),
    "u": (4, 0),
    "v": (5, 0),
    "y": (6, 0),
    "z": (7, 0),
    "8": (0, 1),
    "9": (1, 1),
    "d": (2, 1),
    "e": (3, 1),
    "s": (4, 1),
    "t": (5, 1),
    "w": (6, 1),
    "x": (7, 1),
    "2": (0, 2),
    "3": (1, 2),
    "6": (2, 2),
    "7": (3, 2),
    "k": (4, 2),
    "m": (5, 2),
    "q": (6, 2),
    "r": (7, 2),
    "0": (0, 3),
    "1": (1, 3),
    "4": (2, 3),
    "5": (3, 3),
    "h": (4, 3),
    "j": (5, 3),
    "n": (6, 3),
    "p": (7, 3),
}

odd_col_row = {
    "p": (0, 0),
    "r": (1, 0),
    "x": (2, 0),
    "z": (3, 0),
    "n": (0, 1),
    "q": (1, 1),
    "w": (2, 1),
    "y": (3, 1),
    "j": (0, 2),
    "m": (1, 2),
    "t": (2, 2),
    "v": (3, 2),
    "h": (0, 3),
    "k": (1, 3),
    "s": (2, 3),
    "u": (3, 3),
    "5": (0, 4),
    "7": (1, 4),
    "e": (2, 4),
    "g": (3, 4),
    "4": (0, 5),
    "6": (1, 5),
    "d": (2, 5),
    "f": (3, 5),
    "1": (0, 6),
    "3": (1, 6),
    "9": (2, 6),
    "c": (3, 6),
    "0": (0, 7),
    "2": (1, 7),
    "8": (2, 7),
    "b": (3, 7),
}


inverted_even_col_row = {(x, y): char for char, (x, y) in even_col_row.items()}
inverted_odd_col_row = {(x, y): char for char, (x, y) in odd_col_row.items()}


def col_row_to_geohash(col, row, precision):
    geohash_str = []
    for i in range(
        precision - 1, -1, -1
    ):  # Start from highest precision and work backwards
        if i % 2 == 0:
            # Even precision levels use even_col_row
            sub_col, remainder_col = divmod(col, 8)
            sub_row, remainder_row = divmod(row, 4)
            char = inverted_even_col_row[(remainder_col, remainder_row)]
            col, row = sub_col, sub_row
        else:
            # Odd precision levels use odd_col_row
            sub_col, remainder_col = divmod(col, 4)
            sub_row, remainder_row = divmod(row, 8)
            char = inverted_odd_col_row[(remainder_col, remainder_row)]
            col, row = sub_col, sub_row

        geohash_str.append(char)

    return "".join(reversed(geohash_str))
