from ulid import ULID


def new_id() -> str:
    """ULID: sắp xếp được theo thời gian, sinh ở bất kỳ đâu, sẵn sàng cho sharding (26 ký tự)."""
    return str(ULID())
