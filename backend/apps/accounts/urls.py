from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AuditLogViewSet, MeView, PermissionViewSet, RoleViewSet, UserViewSet

router = DefaultRouter()
router.register("roles", RoleViewSet)
router.register("permissions", PermissionViewSet)
router.register("users", UserViewSet)
router.register("audit-logs", AuditLogViewSet)

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
] + router.urls
