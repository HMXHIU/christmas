import math
from typing import Tuple, TypedDict, Dict
from PIL import Image
import numpy as np
from functools import lru_cache
from .world import WorldSeed, world_seed
from ..utils import (
    string_to_random_number,
    seeded_random,
    geohash_to_grid_cell,
    col_row_to_geohash,
)

INTENSITY_TO_HEIGHT = 8850 / 255


class TopologyTileResult(TypedDict):
    tile_name: str
    top_left: str
    rows: int
    cols: int
    row: int
    col: int
    tl_col: int
    tl_row: int


class Biome(TypedDict):
    biome: str
    name: str
    description: str
    traversableSpeed: float


class Pixel(TypedDict):
    x: float
    y: float
    intensity: float


class InterpolationInputs(TypedDict):
    bl: Pixel
    tl: Pixel
    br: Pixel
    tr: Pixel
    x: float
    y: float


biomes: Dict[str, Biome] = {
    "forest": {
        "biome": "forest",
        "name": "Forest",
        "description": "A dense collection of trees and vegetation, home to a variety of wildlife.",
        "traversableSpeed": 0.8,
    },
    "desert": {
        "biome": "desert",
        "name": "Desert",
        "description": "A dry, arid region with extreme temperatures, sparse vegetation, and limited wildlife.",
        "traversableSpeed": 1.0,
    },
    "tundra": {
        "biome": "tundra",
        "name": "Tundra",
        "description": "A cold, treeless area with a frozen subsoil, limited vegetation, and adapted wildlife.",
        "traversableSpeed": 1.0,
    },
    "grassland": {
        "biome": "grassland",
        "name": "Grassland",
        "description": "A region dominated by grasses, with few trees and a diverse range of wildlife.",
        "traversableSpeed": 1.0,
    },
    "wetland": {
        "biome": "wetland",
        "name": "Wetland",
        "description": "An area saturated with water, supporting aquatic plants and a rich biodiversity.",
        "traversableSpeed": 0.5,
    },
    "mountain": {
        "biome": "mountain",
        "name": "Mountain",
        "description": "A high elevation region with steep terrain, diverse ecosystems, and unique wildlife.",
        "traversableSpeed": 0,
    },
    "hills": {
        "biome": "hills",
        "name": "Hills",
        "description": "A region of elevated terrain, with a variety of wildlife.",
        "traversableSpeed": 0.5,
    },
    "plains": {
        "biome": "plains",
        "name": "Plains",
        "description": "A large area of flat land, with a variety of wildlife.",
        "traversableSpeed": 1.0,
    },
    "swamp": {
        "biome": "swamp",
        "name": "Swamp",
        "description": "A wetland area with a variety of vegetation, supporting a diverse range of wildlife.",
        "traversableSpeed": 0.7,
    },
    "water": {
        "biome": "water",
        "name": "Water",
        "description": "A large body of water, with a variety of aquatic life.",
        "traversableSpeed": 0,
    },
    "ice": {
        "biome": "ice",
        "name": "Ice",
        "description": "A region covered in ice, with limited vegetation and wildlife.",
        "traversableSpeed": 0.8,
    },
}


def biome_at_geohash(geohash: str, seed: WorldSeed | None = None) -> Tuple[str, float]:
    """
    Determines the biome name at the given geohash based on probabilities configured in the world seed.

    Args:
        geohash (str): The geohash coordinate string
        options (Optional[Dict[str, Any]]): Optional parameters including:
            - seed (WorldSeed): Optional world seed to use. Defaults to globally set seed.
            - topologyResultCache (CacheInterface): Cache for topology results
            - topologyBufferCache (CacheInterface): Cache for topology buffers
            - topologyResponseCache (CacheInterface): Cache for topology responses

    Returns:
        Tuple[str, float]: The name of the biome and strength at that geohash.

    TODO: Add caching to avoid redundant calls to biome_at_geohash().
    TODO: Replace with simplex noise etc..

    |----(bio)----|
    |----(bio)----||----(water)----|
    |---dice---|   // bio, strength is taken from mid point 1 - (dice - bio/2) / bio/2
    |-----------dice-----------|   // water, 1 - ((dice - bio) - water/2) / water/2
    """

    seed = seed if seed else world_seed

    # Leave h9* for ice for testing (fully traversable)
    if geohash.startswith("h9"):
        return biomes.ice.biome, 1

    # Get topology
    height = topology_at_geohash(geohash)

    # Below sea level
    if height < 1:
        return biomes["water"]["biome"], 1

    continent = geohash[0]
    prob_bio = seed["seeds"]["continent"][continent]["bio"]
    prob_water = seed["seeds"]["continent"][continent]["water"]
    total_prob = prob_bio + prob_water

    # Use the geohash as the random seed (must be reproducible)
    rv = seeded_random(string_to_random_number(geohash)) * total_prob

    # Select biome
    if rv < prob_bio:
        bio_mid = prob_bio / 2
        return biomes["forest"]["biome"], 1 - abs(rv - bio_mid) / bio_mid
    if rv < prob_bio + prob_water:
        rvv = rv - prob_bio
        water_mid = prob_water / 2
        return biomes["water"]["biome"], 1 - abs(rvv - water_mid) / water_mid
    return biomes["plains"]["biome"], 1


def topology_tile(geohash: str) -> TopologyTileResult:
    """
    Calculates topology tile information for a given geohash.

    Args:
        geohash (str): The geohash to calculate topology for.

    Returns:
        TopologyTileResult: A dictionary containing topology tile information.
    """
    # The topology is stored as 2 precision tiles (4 rows, 8 cols)
    tile = geohash[:2]
    rows = 4
    cols = 8
    top_left = tile
    for i in range(len(geohash) - 2 - 1):
        if i % 2 == 0:
            rows *= 8
            cols *= 4
            top_left += "b"
        else:
            rows *= 4
            cols *= 8
            top_left += "p"

    top_left += "p" if top_left[-1] == "b" else "b"

    tl_cell = geohash_to_grid_cell(top_left)
    cell = geohash_to_grid_cell(geohash)

    return {
        "tile_name": tile,
        "top_left": top_left,
        "rows": rows,
        "cols": cols,
        "col": cell["col"] - tl_cell["col"],
        "row": cell["row"] - tl_cell["row"],
        "tl_col": tl_cell["col"],
        "tl_row": tl_cell["row"],
    }


def bilinear_interpolation(inputs: InterpolationInputs) -> float:
    """
    Performs bilinear interpolation on four pixels to estimate the intensity at a given point.

    Args:
        inputs (InterpolationInputs): A dictionary containing:
            bl (Pixel): Bottom-left corner pixel
            tl (Pixel): Top-left corner pixel
            br (Pixel): Bottom-right corner pixel
            tr (Pixel): Top-right corner pixel
            x (float): X-coordinate of the point to interpolate
            y (float): Y-coordinate of the point to interpolate

    Returns:
        float: The interpolated intensity at the given point (x, y)
    """
    bl, tl, br, tr = inputs["bl"], inputs["tl"], inputs["br"], inputs["tr"]
    x, y = inputs["x"], inputs["y"]

    # Interpolate in the x-direction
    I_x1 = (bl["intensity"] * (br["x"] - x)) / (br["x"] - bl["x"]) + (
        br["intensity"] * (x - bl["x"])
    ) / (br["x"] - bl["x"])
    I_x2 = (tl["intensity"] * (br["x"] - x)) / (br["x"] - bl["x"]) + (
        tr["intensity"] * (x - bl["x"])
    ) / (br["x"] - bl["x"])

    # Interpolate in the y-direction
    I = (I_x1 * (tl["y"] - y)) / (tl["y"] - bl["y"]) + (I_x2 * (y - bl["y"])) / (
        tl["y"] - bl["y"]
    )

    return I


@lru_cache(maxsize=1024)
def topology_at_geohash(geohash: str) -> float:
    """
    Calculates topology information for a given geohash.

    Args:
        geohash (str): The geohash to calculate topology for.

    Returns:
        TopologyResult: A dictionary containing topology information.
    """
    tile_info = topology_tile(geohash)
    rows, cols = tile_info["rows"], tile_info["cols"]
    row, col = tile_info["row"], tile_info["col"]

    # Read the topology buffer
    metadata, data = topology_buffer(tile_info["tile_name"])
    width = metadata["width"]
    height = metadata["height"]

    x_raw = (width - 1) * (col / cols)  # x, y is 0 indexed
    y_raw = (height - 1) * (row / rows)
    x = math.floor(x_raw)  # must use floor not round!!!
    y = math.floor(y_raw)
    x_pixel = x_raw - math.floor(x_raw)
    y_pixel = y_raw - math.floor(y_raw)

    # Smooth out the intensity by averaging the surrounding pixels
    index = y * width + x
    ym = max(y - 1, 0)
    yp = min(y + 1, height - 1)
    xm = max(x - 1, 0)
    xp = min(x + 1, width - 1)
    nw_idx = ym * width + xm
    n_idx = ym * width + x
    ne_idx = ym * width + xp
    w_idx = y * width + xm
    e_idx = y * width + xp
    sw_idx = yp * width + xm
    s_idx = yp * width + x
    se_idx = yp * width + xp

    if x_pixel < 0.5:
        if y_pixel < 0.5:
            # nw, n, w, current
            intensity = bilinear_interpolation(
                {
                    "tl": {"x": -0.5, "y": -0.5, "intensity": data[nw_idx]},  # nw
                    "tr": {"x": 0.5, "y": -0.5, "intensity": data[n_idx]},  # n
                    "bl": {"x": -0.5, "y": 0.5, "intensity": data[w_idx]},  # w
                    "br": {"x": 0.5, "y": 0.5, "intensity": data[index]},  # current
                    "x": x_pixel,
                    "y": y_pixel,
                }
            )
        else:
            # w, current, sw, s
            intensity = bilinear_interpolation(
                {
                    "tl": {"x": -0.5, "y": 0.5, "intensity": data[w_idx]},  # w
                    "tr": {"x": 0.5, "y": 0.5, "intensity": data[index]},  # current
                    "bl": {"x": -0.5, "y": 1.5, "intensity": data[sw_idx]},  # sw
                    "br": {"x": 0.5, "y": 1.5, "intensity": data[s_idx]},  # s
                    "x": x_pixel,
                    "y": y_pixel,
                }
            )
    else:
        if y_pixel < 0.5:
            # n, ne, current, e
            intensity = bilinear_interpolation(
                {
                    "tl": {"x": 0.5, "y": -0.5, "intensity": data[n_idx]},  # n
                    "tr": {"x": 1.5, "y": -0.5, "intensity": data[ne_idx]},  # ne
                    "bl": {"x": 0.5, "y": 0.5, "intensity": data[index]},  # current
                    "br": {"x": 1.5, "y": 0.5, "intensity": data[e_idx]},  # e
                    "x": x_pixel,
                    "y": y_pixel,
                }
            )
        else:
            # current, e, s, se
            intensity = bilinear_interpolation(
                {
                    "tl": {"x": 0.5, "y": 0.5, "intensity": data[index]},  # current
                    "tr": {"x": 1.5, "y": 0.5, "intensity": data[e_idx]},  # e
                    "bl": {"x": 0.5, "y": 1.5, "intensity": data[s_idx]},  # s
                    "br": {"x": 1.5, "y": 1.5, "intensity": data[se_idx]},  # se
                    "x": x_pixel,
                    "y": y_pixel,
                }
            )

    return math.ceil(intensity * INTENSITY_TO_HEIGHT)


@lru_cache(maxsize=128)
def topology_buffer(tile_name: str):
    file_path = f"dm/world/topology_2p/{tile_name}.png"
    with Image.open(file_path) as img:
        metadata = {
            "width": img.width,
            "height": img.height,
            "mode": img.mode,
            "format": img.format,
        }

        pixel_data = np.array(img).flatten()
    print(tile_name)
    return metadata, pixel_data


# (0 is walkable, 1 is not)
def traversable_cost(row: int, col: int) -> int:
    """
    0 is walkable, 1 is not
    For use in a* cost function
    """
    geohash_str = col_row_to_geohash(col, row, 8)
    biome, _ = biome_at_geohash(geohash_str)
    return 0 if biomes[biome]["traversableSpeed"] > 0 else 1
