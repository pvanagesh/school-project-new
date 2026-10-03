from rest_framework.routers import DefaultRouter

from .views import AcademicYearViewSet, SchoolProfileViewSet

router = DefaultRouter()
router.register("school-profile", SchoolProfileViewSet, basename="schoolprofile")
router.register("academic-years", AcademicYearViewSet)

urlpatterns = router.urls
