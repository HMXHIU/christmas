from typing import List, Tuple, Callable, Optional, Set, Dict, Literal
from dataclasses import dataclass


@dataclass
class Node:
    row: int
    col: int
    g: float
    h: float
    f: float
    parent: Optional["Node"] = None


Direction = Literal[
    "n",
    "s",
    "e",
    "w",
    "ne",
    "nw",
    "se",
    "sw",
    "u",
    "d",
]
DirectionVector = Tuple[int, int]

direction_vectors: Dict[Direction, DirectionVector] = {
    "n": (-1, 0),
    "s": (1, 0),
    "e": (0, 1),
    "w": (0, -1),
    "ne": (-1, 1),
    "nw": (-1, -1),
    "se": (1, 1),
    "sw": (1, -1),
    "u": (0, 0),
    "d": (
        0,
        0,
    ),  # Assuming "u" and "d" are placeholders for different layers, ignoring for 2D grid
}


def a_star_pathfinding(
    row_start: int,
    col_start: int,
    row_end: int,
    col_end: int,
    get_traversal_cost: Callable[[int, int], int],
    range: Optional[int] = None,
    max_iterations: Optional[int] = 500,
) -> List[Direction]:
    """
    Performs A* pathfinding algorithm to find the optimal path between two points on a map.

    :param row_start: The starting row index.
    :param row_end: The ending row index.
    :param col_start: The starting column index.
    :param col_end: The ending column index.
    :param get_traversal_cost: A function that returns the traversal cost for a given cell (0 is walkable, 1 is not).
    :param range: Stop if within range (eg. ability range)
    :return: An array of directions representing the optimal path (eg. ['n', 's', 'e', 'w']).
    """

    def heuristic(row: int, col: int, row_end: int, col_end: int) -> int:
        return abs(row - row_end) + abs(col - col_end)  # Manhattan distance

    def neighbors(node: Node) -> List[Node]:
        result = []
        for key, (dr, dc) in direction_vectors.items():
            new_row = node.row + dr
            new_col = node.col + dc
            if get_traversal_cost(new_row, new_col) == 0:
                result.append(
                    Node(
                        row=new_row,
                        col=new_col,
                        g=node.g + 1,
                        h=heuristic(new_row, new_col, row_end, col_end),
                        f=0,
                        parent=node,
                    )
                )
        return result

    def reconstruct_path(node: Node) -> List[Direction]:
        path = []
        current = node
        while current.parent:
            dr = current.row - current.parent.row
            dc = current.col - current.parent.col
            for key, (drow, dcol) in direction_vectors.items():
                if dr == drow and dc == dcol:
                    path.append(key)
                    break
            current = current.parent
        return list(reversed(path))

    open_list: List[Node] = []
    closed_list: Set[str] = set()

    start_node = Node(
        row=row_start,
        col=col_start,
        g=0,
        h=heuristic(row_start, col_start, row_end, col_end),
        f=0,
    )
    start_node.f = start_node.g + start_node.h
    open_list.append(start_node)

    def is_within_range(row: int, col: int, range: int) -> bool:
        return heuristic(row, col, row_end, col_end) <= range

    iterations = 0
    while open_list and iterations < max_iterations:
        iterations += 1
        open_list.sort(key=lambda x: x.f)
        current_node = open_list.pop(0)
        current_key = f"{current_node.row},{current_node.col}"

        if current_node.row == row_end and current_node.col == col_end:
            return reconstruct_path(current_node)

        # Early exit if in range
        if range is not None and is_within_range(
            current_node.row, current_node.col, range
        ):
            return reconstruct_path(current_node)

        closed_list.add(current_key)

        neighbor_nodes = neighbors(current_node)
        for neighbor in neighbor_nodes:
            neighbor_key = f"{neighbor.row},{neighbor.col}"
            if neighbor_key in closed_list:
                continue

            open_node = next(
                (
                    node
                    for node in open_list
                    if node.row == neighbor.row and node.col == neighbor.col
                ),
                None,
            )
            if not open_node:
                neighbor.f = neighbor.g + neighbor.h
                open_list.append(neighbor)
            elif neighbor.g < open_node.g:
                open_node.g = neighbor.g
                open_node.f = open_node.g + open_node.h
                open_node.parent = current_node

    return []  # No path found
