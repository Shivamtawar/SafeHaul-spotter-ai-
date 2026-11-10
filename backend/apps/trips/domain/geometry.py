"""Pure geometry helpers: distances along a polyline, checkpoint sampling, simplification."""

import math
from collections.abc import Sequence
from itertools import pairwise

type LatLon = tuple[float, float]

EARTH_RADIUS_MILES = 3958.7613


def haversine_miles(a: LatLon, b: LatLon) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * (
        math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(h))


def cumulative_miles(points: Sequence[LatLon]) -> list[float]:
    """Distance from the first point to each point along the polyline."""
    totals = [0.0]
    for previous, current in pairwise(points):
        totals.append(totals[-1] + haversine_miles(previous, current))
    return totals


def point_at_mile(points: Sequence[LatLon], cumulative: Sequence[float], mile: float) -> LatLon:
    """Position at ``mile`` along the polyline, interpolated linearly within a segment."""
    if mile <= 0:
        return points[0]
    if mile >= cumulative[-1]:
        return points[-1]
    lo, hi = 0, len(cumulative) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if cumulative[mid] <= mile:
            lo = mid
        else:
            hi = mid
    fraction = (mile - cumulative[lo]) / (cumulative[hi] - cumulative[lo])  # span > 0 here
    (lat1, lon1), (lat2, lon2) = points[lo], points[hi]
    return (lat1 + (lat2 - lat1) * fraction, lon1 + (lon2 - lon1) * fraction)


def checkpoint_miles(total_miles: float, interval_miles: float) -> list[float]:
    """Mile markers at every interval, always including the origin and the destination."""
    if interval_miles <= 0:
        raise ValueError("interval_miles must be positive")
    markers = [0.0]
    mile = interval_miles
    while mile < total_miles - 1e-9:
        markers.append(mile)
        mile += interval_miles
    if total_miles > 0:
        markers.append(total_miles)
    return markers


def simplify(points: Sequence[LatLon], tolerance_miles: float) -> list[LatLon]:
    """Douglas-Peucker simplification (iterative), used to keep map payloads small."""
    if len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        farthest, index = 0.0, -1
        for i in range(start + 1, end):
            distance = distance_to_segment_miles(points[i], points[start], points[end])
            if distance > farthest:
                farthest, index = distance, i
        if index != -1 and farthest > tolerance_miles:
            keep[index] = True
            stack.extend([(start, index), (index, end)])
    return [point for point, kept in zip(points, keep, strict=True) if kept]


def distance_to_segment_miles(p: LatLon, a: LatLon, b: LatLon) -> float:
    # Local equirectangular projection around the segment: accurate for map-scale tolerances.
    lat0 = math.radians((a[0] + b[0]) / 2)

    def project(point: LatLon) -> tuple[float, float]:
        return (
            math.radians(point[1]) * math.cos(lat0) * EARTH_RADIUS_MILES,
            math.radians(point[0]) * EARTH_RADIUS_MILES,
        )

    px, py = project(p)
    ax, ay = project(a)
    bx, by = project(b)
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def overlap_fraction(
    candidate: Sequence[LatLon],
    reference: Sequence[LatLon],
    *,
    tolerance_miles: float = 1.0,
    spacing_miles: float = 5.0,
) -> float:
    """Share of ``candidate`` (by length) that runs within ``tolerance_miles`` of ``reference``.

    1.0 means the candidate follows the reference everywhere; 0.0 means it never comes close.
    """
    segments = list(pairwise(simplify(reference, tolerance_miles / 4)))
    if not segments:
        return 0.0
    cumulative = cumulative_miles(candidate)
    marks = checkpoint_miles(cumulative[-1], spacing_miles)
    near = 0
    for mile in marks:
        point = point_at_mile(candidate, cumulative, mile)
        if any(distance_to_segment_miles(point, a, b) <= tolerance_miles for a, b in segments):
            near += 1
    return near / len(marks)
