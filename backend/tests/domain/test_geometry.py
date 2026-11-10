import pytest

from apps.trips.domain.geometry import (
    checkpoint_miles,
    cumulative_miles,
    haversine_miles,
    overlap_fraction,
    point_at_mile,
    simplify,
)

DALLAS = (32.7767, -96.7970)
DENVER = (39.7392, -104.9903)
MILES_PER_DEGREE_AT_EQUATOR = 69.09


def test_haversine_of_identical_points_is_zero() -> None:
    assert haversine_miles(DALLAS, DALLAS) == 0


def test_haversine_one_degree_of_longitude_at_the_equator() -> None:
    assert haversine_miles((0, 0), (0, 1)) == pytest.approx(MILES_PER_DEGREE_AT_EQUATOR, abs=0.05)


def test_haversine_dallas_to_denver_straight_line() -> None:
    assert haversine_miles(DALLAS, DENVER) == pytest.approx(664, abs=3)


def test_cumulative_miles_starts_at_zero_and_accumulates() -> None:
    points = [(0, 0), (0, 1), (0, 2)]
    totals = cumulative_miles(points)
    assert totals[0] == 0
    assert totals[2] == pytest.approx(2 * MILES_PER_DEGREE_AT_EQUATOR, abs=0.1)
    assert totals == sorted(totals)


def test_point_at_mile_interpolates_inside_a_segment() -> None:
    points = [(0.0, 0.0), (0.0, 2.0)]
    totals = cumulative_miles(points)
    lat, lon = point_at_mile(points, totals, totals[-1] / 2)
    assert lat == pytest.approx(0)
    assert lon == pytest.approx(1)


def test_point_at_mile_clamps_to_the_ends() -> None:
    points = [(0.0, 0.0), (0.0, 1.0), (0.0, 2.0)]
    totals = cumulative_miles(points)
    assert point_at_mile(points, totals, -5) == points[0]
    assert point_at_mile(points, totals, 10_000) == points[-1]


def test_point_at_mile_picks_the_right_segment() -> None:
    points = [(0.0, 0.0), (0.0, 1.0), (0.0, 3.0)]
    totals = cumulative_miles(points)
    _, lon = point_at_mile(points, totals, totals[1] + (totals[2] - totals[1]) / 2)
    assert lon == pytest.approx(2)


def test_point_at_mile_finds_an_early_segment() -> None:
    points = [(0.0, float(i)) for i in range(5)]
    totals = cumulative_miles(points)
    _, lon = point_at_mile(points, totals, totals[1] / 2)
    assert lon == pytest.approx(0.5)


def test_point_at_mile_handles_a_zero_length_segment() -> None:
    points = [(1.0, 1.0), (1.0, 1.0), (1.0, 2.0)]
    totals = cumulative_miles(points)
    assert point_at_mile(points, totals, 0.0001) == pytest.approx((1.0, 1.0), abs=1e-3)


def test_checkpoint_miles_includes_origin_and_destination() -> None:
    assert checkpoint_miles(100, 25) == [0, 25, 50, 75, 100]


def test_checkpoint_miles_adds_a_final_partial_stretch() -> None:
    assert checkpoint_miles(110, 25) == [0, 25, 50, 75, 100, 110]


def test_checkpoint_miles_shorter_than_interval() -> None:
    assert checkpoint_miles(10, 25) == [0, 10]


def test_checkpoint_miles_for_zero_length_route() -> None:
    assert checkpoint_miles(0, 25) == [0]


@pytest.mark.parametrize("interval", [0, -10])
def test_checkpoint_miles_rejects_bad_interval(interval: float) -> None:
    with pytest.raises(ValueError, match="interval_miles"):
        checkpoint_miles(100, interval)


def test_simplify_drops_collinear_points() -> None:
    points = [(0.0, 0.0), (0.0, 0.5), (0.0, 1.0), (0.0, 1.5), (0.0, 2.0)]
    assert simplify(points, tolerance_miles=0.1) == [points[0], points[-1]]


def test_simplify_keeps_a_real_bend() -> None:
    points = [(0.0, 0.0), (1.0, 1.0), (0.0, 2.0)]
    assert simplify(points, tolerance_miles=1.0) == points


def test_simplify_always_keeps_endpoints_and_order() -> None:
    points = [(0.0, 0.0), (0.001, 0.5), (0.0, 1.0), (0.5, 1.5), (0.0, 2.0)]
    result = simplify(points, tolerance_miles=0.5)
    assert result[0] == points[0]
    assert result[-1] == points[-1]
    assert result == [p for p in points if p in result]


def test_simplify_leaves_short_lines_alone() -> None:
    assert simplify([(0.0, 0.0), (1.0, 1.0)], 5) == [(0.0, 0.0), (1.0, 1.0)]


def test_simplify_handles_a_closed_loop() -> None:
    loop = [(0.0, 0.0), (0.0, 1.0), (1.0, 1.0), (0.0, 0.0)]
    assert simplify(loop, tolerance_miles=0.1) == loop


def line(latitude: float, lon_from: float = 0.0, lon_to: float = 3.0) -> list[tuple[float, float]]:
    return [(latitude, lon_from), (latitude, lon_to)]


def test_a_route_fully_overlaps_itself() -> None:
    assert overlap_fraction(line(0), line(0)) == 1.0


def test_routes_far_apart_do_not_overlap() -> None:
    assert overlap_fraction(line(0), line(1)) == 0.0  # about 69 miles apart


def test_a_route_a_fraction_of_a_mile_away_counts_as_the_same_road() -> None:
    assert overlap_fraction(line(0), line(0.005)) == 1.0


def test_partial_overlap_is_measured_by_length() -> None:
    # The candidate follows the reference for the first third, then leaves it.
    candidate = [(0.0, 0.0), (0.0, 1.0), (1.0, 2.0), (1.0, 3.0)]
    fraction = overlap_fraction(candidate, line(0))
    assert 0.2 < fraction < 0.5


def test_overlap_is_not_symmetric_for_a_route_that_is_a_prefix_of_another() -> None:
    short, long = line(0, 0.0, 1.0), line(0, 0.0, 3.0)
    assert overlap_fraction(short, long) == 1.0
    assert overlap_fraction(long, short) < 0.5


def test_a_reference_without_a_segment_has_no_overlap() -> None:
    assert overlap_fraction(line(0), [(0.0, 0.0)]) == 0.0


def test_a_zero_length_candidate_is_judged_by_its_one_point() -> None:
    assert overlap_fraction([(0.0, 1.0), (0.0, 1.0)], line(0)) == 1.0
    assert overlap_fraction([(5.0, 1.0), (5.0, 1.0)], line(0)) == 0.0
