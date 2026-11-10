import pytest

from apps.trips.providers.polyline import decode_polyline

from .helpers import encode_polyline


def test_decodes_the_reference_example() -> None:
    # Example from the encoded polyline algorithm format documentation (precision 5).
    points = decode_polyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@", precision=5)
    expected = [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
    assert [c for p in points for c in p] == pytest.approx([c for p in expected for c in p])


def test_round_trips_precision_six() -> None:
    original = [(32.776664, -96.796988), (35.0, -100.5), (39.739236, -104.990251)]
    decoded = decode_polyline(encode_polyline(original))
    assert [c for p in decoded for c in p] == pytest.approx([c for p in original for c in p])


def test_empty_string_decodes_to_no_points() -> None:
    assert decode_polyline("") == []
