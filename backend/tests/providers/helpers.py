"""Test helpers shared by the provider tests."""

from collections.abc import Sequence


def encode_polyline(points: Sequence[tuple[float, float]], precision: int = 6) -> str:
    factor = 10**precision
    encoded: list[str] = []
    previous = (0, 0)
    for lat, lon in points:
        current = (round(lat * factor), round(lon * factor))
        for delta in (current[0] - previous[0], current[1] - previous[1]):
            value = ~(delta << 1) if delta < 0 else delta << 1
            while value >= 0x20:
                encoded.append(chr((0x20 | (value & 0x1F)) + 63))
                value >>= 5
            encoded.append(chr(value + 63))
        previous = current
    return "".join(encoded)
