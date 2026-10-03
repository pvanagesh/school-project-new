from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.scoping import filter_classes_by_division
from apps.students.models import Student
from apps.teachers.scoping import is_teacher_role, teacher_section_subject_pairs

from .models import AssessmentConfig, Exam, MarksEntry, SubjectMarksConfig
from .serializers import (
    AssessmentConfigSerializer,
    ExamSerializer,
    MarksEntrySerializer,
    SubjectMarksConfigSerializer,
)


class ExamViewSet(viewsets.ModelViewSet):
    queryset = Exam.objects.select_related("academic_year", "school_class").all()
    serializer_class = ExamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return filter_classes_by_division(super().get_queryset(), self.request.user, prefix="school_class__")


class AssessmentConfigViewSet(viewsets.ModelViewSet):
    queryset = AssessmentConfig.objects.select_related("school_class").all()
    serializer_class = AssessmentConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return filter_classes_by_division(super().get_queryset(), self.request.user, prefix="school_class__")


class SubjectMarksConfigViewSet(viewsets.ModelViewSet):
    queryset = SubjectMarksConfig.objects.select_related("subject", "school_class").all()
    serializer_class = SubjectMarksConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = filter_classes_by_division(super().get_queryset(), self.request.user, prefix="school_class__")
        school_class = self.request.query_params.get("class")
        if school_class:
            qs = qs.filter(school_class_id=school_class)
        return qs


def _teacher_scope_queryset(qs, user):
    """Restricts a MarksEntry queryset to only the (section, subject) pairs
    the given teacher actually teaches, per their Timetable assignments."""
    pairs = teacher_section_subject_pairs(user)
    if not pairs:
        return qs.none()
    scope = Q()
    for section_id, subject_id in pairs:
        scope |= Q(subject_id=subject_id, student__current_section_id=section_id)
    return qs.filter(scope)


class MarksEntryViewSet(viewsets.ModelViewSet):
    queryset = MarksEntry.objects.select_related("student", "subject", "exam", "published_by").all()
    serializer_class = MarksEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = filter_classes_by_division(super().get_queryset(), self.request.user, prefix="student__current_class__")
        student = self.request.query_params.get("student")
        exam = self.request.query_params.get("exam")
        subject = self.request.query_params.get("subject")
        if student:
            qs = qs.filter(student_id=student)
        if exam:
            qs = qs.filter(exam_id=exam)
        if subject:
            qs = qs.filter(subject_id=subject)
        if is_teacher_role(self.request.user):
            qs = _teacher_scope_queryset(qs, self.request.user)
        return qs

    @action(detail=False, methods=["post"])
    def bulk_save(self, request):
        exam_id = request.data.get("exam")
        subject_id = request.data.get("subject")
        entries = request.data.get("entries", [])
        if not exam_id or not subject_id or not entries:
            return Response({"detail": "exam, subject and entries are required."}, status=400)

        if is_teacher_role(request.user):
            pairs = teacher_section_subject_pairs(request.user)
            student_ids = [entry.get("student") for entry in entries if entry.get("student")]
            out_of_scope = Student.objects.filter(id__in=student_ids).exclude(
                current_section_id__in={section_id for section_id, sid in pairs if sid == int(subject_id)}
            )
            if out_of_scope.exists():
                return Response(
                    {"detail": "You can only enter marks for subjects you teach in this section."}, status=403
                )

        saved = []
        for entry in entries:
            student_id = entry.get("student")
            if not student_id:
                continue
            obj, _ = MarksEntry.objects.update_or_create(
                student_id=student_id,
                subject_id=subject_id,
                exam_id=exam_id,
                defaults={
                    "theory_marks": entry.get("theory_marks") or None,
                    "internal_marks": entry.get("internal_marks") or None,
                    "grade": entry.get("grade") or "",
                },
            )
            saved.append(obj)

        serializer = self.get_serializer(saved, many=True)
        return Response(serializer.data, status=200)

    @action(detail=False, methods=["post"])
    def publish(self, request):
        exam_id = request.data.get("exam")
        subject_id = request.data.get("subject")
        if not exam_id or not subject_id:
            return Response({"detail": "exam and subject are required."}, status=400)

        qs = MarksEntry.objects.filter(exam_id=exam_id, subject_id=subject_id)
        if is_teacher_role(request.user):
            pairs = teacher_section_subject_pairs(request.user)
            allowed_sections = {section_id for section_id, sid in pairs if sid == int(subject_id)}
            if not allowed_sections:
                return Response(
                    {"detail": "You can only publish marks for subjects you teach."}, status=403
                )
            qs = qs.filter(student__current_section_id__in=allowed_sections)

        updated = qs.update(is_published=True, published_at=timezone.now(), published_by=request.user)
        return Response({"updated": updated}, status=200)
