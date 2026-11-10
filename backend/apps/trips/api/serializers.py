"""Request validation and the documented response shape (also the source of the OpenAPI schema)."""

from datetime import datetime
from typing import Any

from rest_framework import serializers

ALLOWED_INTERVALS = (10, 25, 50)
MAX_LOAD_LBS = 120_000
MIN_QUERY_LENGTH = 3
INVALID_DATETIME = "Enter an ISO 8601 date-time, for example 2026-11-12T08:00:00-06:00."
NAIVE_DATETIME = "The date-time must include a UTC offset (for example Z or -06:00)."


class AwareDateTimeField(serializers.Field[datetime, str, str, Any]):
    """ISO 8601 date-time that must carry a UTC offset, so departures are never ambiguous."""

    def to_internal_value(self, data: Any) -> datetime:
        if not isinstance(data, str):
            raise serializers.ValidationError(INVALID_DATETIME, code="invalid")
        try:
            value = datetime.fromisoformat(data)
        except ValueError:
            raise serializers.ValidationError(INVALID_DATETIME, code="invalid") from None
        if value.tzinfo is None:
            raise serializers.ValidationError(NAIVE_DATETIME, code="naive")
        return value

    def to_representation(self, value: datetime) -> str:
        return value.isoformat()


class PointSerializer(serializers.Serializer[Any]):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lon = serializers.FloatField(min_value=-180, max_value=180)
    name = serializers.CharField(required=False, allow_blank=True, max_length=200)


class PlanRequestSerializer(serializers.Serializer[Any]):
    origin = PointSerializer()
    destination = PointSerializer()
    departure = AwareDateTimeField()
    load_lbs = serializers.IntegerField(min_value=1, max_value=MAX_LOAD_LBS)
    interval_miles = serializers.ChoiceField(choices=ALLOWED_INTERVALS, default=25)


class GeocodeQuerySerializer(serializers.Serializer[Any]):
    q = serializers.CharField(min_length=MIN_QUERY_LENGTH, max_length=200)


class PlaceSerializer(serializers.Serializer[Any]):
    name = serializers.CharField()
    lat = serializers.FloatField()
    lon = serializers.FloatField()


class WarningSerializer(serializers.Serializer[Any]):
    severity = serializers.ChoiceField(choices=["critical", "warning"])
    message = serializers.CharField()


class CheckpointSerializer(serializers.Serializer[Any]):
    mile = serializers.FloatField()
    lat = serializers.FloatField()
    lon = serializers.FloatField()
    eta = AwareDateTimeField()
    level = serializers.IntegerField(help_text="0 Low, 1 Moderate, 2 High, 3 Severe, 4 No Travel")
    level_label = serializers.CharField()
    wind_mph = serializers.FloatField()
    rain_in_hr = serializers.FloatField()
    snow_in_hr = serializers.FloatField()
    reasons = serializers.ListField(child=serializers.CharField())


class MilesByLevelSerializer(serializers.Serializer[Any]):
    low = serializers.FloatField()
    moderate = serializers.FloatField()
    high = serializers.FloatField()
    severe = serializers.FloatField()
    no_travel = serializers.FloatField()


class RouteSerializer(serializers.Serializer[Any]):
    route_id = serializers.CharField()
    rank = serializers.IntegerField(help_text="1 is the best route")
    recommended = serializers.BooleanField()
    distance_miles = serializers.FloatField()
    duration_seconds = serializers.IntegerField()
    arrival = AwareDateTimeField()
    avg_risk = serializers.FloatField(help_text="Mile-weighted mean level, 0 to 4")
    has_no_travel = serializers.BooleanField()
    miles_by_level = MilesByLevelSerializer()
    warnings = WarningSerializer(many=True)
    geometry = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField()),
        help_text="[lat, lon] pairs, simplified for display",
    )
    checkpoints = CheckpointSerializer(many=True)


class HeatmapPointSerializer(serializers.Serializer[Any]):
    lat = serializers.FloatField()
    lon = serializers.FloatField()
    levels = serializers.ListField(
        child=serializers.IntegerField(), help_text="Risk level for each hour from `start`"
    )


class HeatmapSerializer(serializers.Serializer[Any]):
    start = AwareDateTimeField(help_text="The UTC hour of departure; levels[h] is h hours later")
    hours = serializers.IntegerField(help_text="Number of hourly values per point")
    points = HeatmapPointSerializer(many=True)


class PlanResponseSerializer(serializers.Serializer[Any]):
    departure = AwareDateTimeField()
    load_lbs = serializers.IntegerField()
    interval_miles = serializers.IntegerField()
    recommended_route_id = serializers.CharField()
    recommended_is_safe = serializers.BooleanField(
        help_text="False when every route contains No Travel weather"
    )
    routes = RouteSerializer(many=True)
    heatmap = HeatmapSerializer()
