from rest_framework.routers import DefaultRouter

from .views import AttendanceViewSet, PastAttendanceEditGrantViewSet

router = DefaultRouter()
router.register("attendance", AttendanceViewSet)
router.register("past-attendance-edit-grants", PastAttendanceEditGrantViewSet)

urlpatterns = router.urls
