"""Travel-time profile along a route: converts a position into elapsed driving time."""

from bisect import bisect_right
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True, slots=True)
class TravelProfile:
    """Elapsed seconds at fractions of the route, built from the routing provider's steps.

    Working in fractions of the route (not absolute miles) keeps ETAs consistent even though
    the provider's distance and our haversine distance differ slightly.
    """

    fractions: tuple[float, ...]
    seconds: tuple[float, ...]

    @classmethod
    def from_steps(cls, steps: Sequence[tuple[float, float]]) -> TravelProfile:
        """Build from ``(distance, duration_seconds)`` steps, in route order."""
        total_distance = sum(distance for distance, _ in steps)
        if not steps or total_distance <= 0:
            raise ValueError("steps must cover a positive distance")
        fractions, seconds = [0.0], [0.0]
        covered = elapsed = 0.0
        for distance, duration in steps:
            covered += distance
            elapsed += duration
            fractions.append(covered / total_distance)
            seconds.append(elapsed)
        return cls(tuple(fractions), tuple(seconds))

    @property
    def total_seconds(self) -> float:
        return self.seconds[-1]

    def elapsed_seconds(self, fraction: float) -> float:
        fraction = min(max(fraction, 0.0), 1.0)
        index = bisect_right(self.fractions, fraction)
        if index >= len(self.fractions):
            return self.seconds[-1]
        lo = index - 1
        span = self.fractions[index] - self.fractions[lo]  # > 0 by bisect_right
        weight = (fraction - self.fractions[lo]) / span
        return self.seconds[lo] + weight * (self.seconds[index] - self.seconds[lo])

    def eta(self, departure: datetime, fraction: float) -> datetime:
        return departure + timedelta(seconds=self.elapsed_seconds(fraction))
