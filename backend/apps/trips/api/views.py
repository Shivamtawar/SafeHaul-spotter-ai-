from typing import Any

from django.http import HttpRequest, JsonResponse
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.trips.services.types import TripRequest

from . import dependencies
from .presenters import present_plan
from .serializers import (
    GeocodeQuerySerializer,
    PlaceSerializer,
    PlanRequestSerializer,
    PlanResponseSerializer,
)

ERROR_RESPONSE = OpenApiResponse(description="Error envelope: {error: {code, message, details}}")


@api_view(["GET"])
@throttle_classes([])
def healthz(_request: Request) -> Response:
    return Response({"status": "ok"})


class GeocodeView(APIView):
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "geocode"

    @extend_schema(
        summary="Search for a place",
        parameters=[GeocodeQuerySerializer],
        responses={200: PlaceSerializer(many=True), 400: ERROR_RESPONSE, 502: ERROR_RESPONSE},
    )
    def get(self, request: Request) -> Response:
        query = GeocodeQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        places = dependencies.get_geocoder().search(query.validated_data["q"])
        return Response(
            PlaceSerializer(
                [{"name": p.label, "lat": p.position[0], "lon": p.position[1]} for p in places],
                many=True,
            ).data
        )


class PlanView(APIView):
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "plan"

    @extend_schema(
        summary="Plan a weather-aware truck trip",
        description=(
            "Returns up to three routes ranked by weather risk, each with checkpoints sampled "
            "at the requested interval, plus an hourly risk grid for the next 48 hours."
        ),
        request=PlanRequestSerializer,
        responses={
            200: PlanResponseSerializer,
            400: ERROR_RESPONSE,
            404: ERROR_RESPONSE,
            422: ERROR_RESPONSE,
            429: ERROR_RESPONSE,
            502: ERROR_RESPONSE,
        },
    )
    def post(self, request: Request) -> Response:
        body = PlanRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data: dict[str, Any] = body.validated_data
        trip = TripRequest(
            origin=(data["origin"]["lat"], data["origin"]["lon"]),
            destination=(data["destination"]["lat"], data["destination"]["lon"]),
            departure=data["departure"],
            load_lbs=data["load_lbs"],
            interval_miles=data["interval_miles"],
        )
        plan = dependencies.get_plan_service().plan(trip)
        return Response(PlanResponseSerializer(present_plan(plan)).data)


def server_error(_request: HttpRequest) -> JsonResponse:
    """JSON 500 so clients always receive the error envelope."""
    return JsonResponse(
        {"error": {"code": "server_error", "message": "Something went wrong.", "details": None}},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
