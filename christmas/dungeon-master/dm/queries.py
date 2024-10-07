from redis.commands.search.query import Query


def logged_in_players_query():
    return Query("@lgn:{true}")


def players_in_geohash_query(geohashes):
    geohash_query = " | ".join([f"(@loc:{{{gh}*}})" for gh in geohashes])
    return Query(f"(@locT:{{geohash}}) ({geohash_query})")


def monsters_in_geohash_query(geohashes):
    geohash_query = " | ".join([f"(@loc:{{{gh}*}})" for gh in geohashes])
    return Query(f"(@locT:{{geohash}}) ({geohash_query})")


def items_in_geohash_query(geohashes):
    geohash_query = " | ".join([f"(@loc:{{{gh}*}})" for gh in geohashes])
    return Query(f"(@locT:{{geohash}}) ({geohash_query})")


def worlds_in_geohash_query(geohashes):
    geohash_query = " | ".join([f"(@loc:{{{gh}*}})" for gh in geohashes])
    return Query(geohash_query)


def has_world_collider_query(geohash):
    return Query(f"@cld:{{{geohash}*}}")


def inventory_query(player):
    return Query(f"@loc:{{{player}}}")


def equipment_query(player):
    return Query(f"-@locT:{{geohash}} -@locT:{{inv}} @loc:{{{player}}}")
