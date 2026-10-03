from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MyTeacherProfileView, TeacherViewSet

router = DefaultRouter()
router.register("teachers", TeacherViewSet)

urlpatterns = [
    path("me/", MyTeacherProfileView.as_view(), name="teacher-me"),
] + router.urls
