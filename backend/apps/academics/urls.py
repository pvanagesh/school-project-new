from django.urls import path
from rest_framework.routers import DefaultRouter

from .ai_timetable import AIGenerationHistoryViewSet, GenerateAITimetableView
from .views import (
    ClassStreamProfileViewSet,
    CommonRoomViewSet,
    ProfileSubjectViewSet,
    SchoolClassViewSet,
    SectionSubjectViewSet,
    SectionViewSet,
    SubjectViewSet,
    TimetableViewSet,
)

router = DefaultRouter()
router.register("classes", SchoolClassViewSet)
router.register("sections", SectionViewSet)
router.register("subjects", SubjectViewSet)
router.register("common-rooms", CommonRoomViewSet)
router.register("stream-profiles", ClassStreamProfileViewSet)
router.register("profile-subjects", ProfileSubjectViewSet)
router.register("section-subjects", SectionSubjectViewSet)
router.register("timetable", TimetableViewSet)
router.register("ai-timetable-history", AIGenerationHistoryViewSet)

urlpatterns = [
    path("timetable/generate-ai/", GenerateAITimetableView.as_view(), name="timetable-generate-ai"),
] + router.urls
