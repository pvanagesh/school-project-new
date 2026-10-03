from rest_framework.routers import DefaultRouter

from .views import (
    AssessmentConfigViewSet,
    ExamViewSet,
    MarksEntryViewSet,
    SubjectMarksConfigViewSet,
)

router = DefaultRouter()
router.register("exams", ExamViewSet)
router.register("assessment-configs", AssessmentConfigViewSet)
router.register("subject-marks-configs", SubjectMarksConfigViewSet)
router.register("marks-entries", MarksEntryViewSet)

urlpatterns = router.urls
