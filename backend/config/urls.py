from django.urls import path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.trips.api import views
from apps.trips.api.spa import spa

handler500 = "apps.trips.api.views.server_error"

urlpatterns = [
    path("healthz", views.healthz, name="healthz"),
    path("api/v1/geocode", views.GeocodeView.as_view(), name="geocode"),
    path("api/v1/plan", views.PlanView.as_view(), name="plan"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    # Everything that is not the API is a page of the React app (must stay last).
    re_path(r"^(?!api/|healthz$)(?P<path>.*)$", spa, name="spa"),
]
