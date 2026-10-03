import requests
from django.conf import settings
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import AcademicYear, SchoolProfile
from apps.teachers.models import Teacher

from .models import AIGenerationHistory, SchoolClass, SectionSubject, Timetable
from .serializers import AIGenerationHistorySerializer

WORKING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def _period_schedule():
    periods = Timetable.objects.values_list("period", "start_time", "end_time").distinct().order_by("period")
    return [
        {
            "label": f"P{period}",
            "start_time": start.strftime("%H:%M"),
            "end_time": end.strftime("%H:%M"),
            "is_teaching_period": True,
        }
        for period, start, end in periods
    ]


def _classes(class_names):
    queryset = SchoolClass.objects.prefetch_related("sections").order_by("id")
    if class_names:
        queryset = queryset.filter(name__in=class_names)
    classes = []
    for school_class in queryset:
        section_labels = []
        for section in school_class.sections.all():
            suffix = section.combination or section.stream
            section_labels.append(f"{section.name} ({suffix})" if suffix else section.name)
        classes.append({"name": school_class.name, "sections": section_labels})
    return classes


def _subjects(class_names):
    links = SectionSubject.objects.select_related("subject", "section__school_class")
    if class_names:
        links = links.filter(section__school_class__name__in=class_names)
    subjects: dict[str, set[str]] = {}
    for link in links:
        subjects.setdefault(link.subject.name, set()).add(link.section.school_class.name)
    return [
        {"name": name, "applicable_classes": sorted(classes)}
        for name, classes in sorted(subjects.items())
    ]


def _teachers():
    teachers = []
    for teacher in Teacher.objects.all():
        specialization = [s.strip() for s in teacher.subject_specialization.split(",") if s.strip()]
        teachers.append(
            {
                "teacher_id": teacher.teacher_id,
                "name": f"{teacher.first_name} {teacher.last_name}",
                "subject_specialization": specialization,
                "qualification": teacher.qualification,
            }
        )
    return teachers


def build_school_data(class_names=None):
    profile = SchoolProfile.objects.first()
    active_year = AcademicYear.objects.filter(is_active=True).first()
    return {
        "school_name": profile.name if profile else "Vedha Educational Society",
        "academic_year": active_year.name if active_year else "2026-2027",
        "board": profile.board if profile else "CBSE",
        "state": profile.state if profile else "Andhra Pradesh",
        "working_days": WORKING_DAYS,
        "period_schedule": _period_schedule(),
        "classes": _classes(class_names),
        "subjects": _subjects(class_names),
        "teachers": _teachers(),
    }


class GenerateAITimetableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        provider = request.data.get("provider") or None
        model = request.data.get("model") or None
        extra_instructions = request.data.get("extra_instructions") or None
        class_names = request.data.get("class_names") or None

        school_data = build_school_data(class_names)
        if not school_data["classes"]:
            return Response({"detail": "No classes/sections found to generate a timetable for."}, status=400)

        payload = {
            "school_data": school_data,
            "provider": provider,
            "model": model,
            "extra_instructions": extra_instructions,
        }
        headers = {"x-api-key": settings.AISERVICE_API_KEY} if settings.AISERVICE_API_KEY else {}

        try:
            response = requests.post(
                f"{settings.AISERVICE_BASE_URL}/timetable/generate",
                json=payload,
                headers=headers,
                timeout=settings.AISERVICE_TIMEOUT_SECONDS,
            )
        except requests.exceptions.ConnectionError:
            return Response({"detail": "AI service is not reachable. Is it running?"}, status=502)
        except requests.exceptions.Timeout:
            return Response({"detail": "AI service timed out generating the timetable."}, status=504)

        try:
            data = response.json()
        except ValueError:
            return Response({"detail": "AI service returned an unexpected response."}, status=502)

        if response.status_code == 200 and data.get("raw_output"):
            AIGenerationHistory.objects.create(
                created_by=request.user,
                provider=data.get("provider", ""),
                model=data.get("model", ""),
                class_names=class_names or [],
                extra_instructions=extra_instructions or "",
                raw_output=data["raw_output"],
            )

        return Response(data, status=response.status_code)


class AIGenerationHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AIGenerationHistory.objects.select_related("created_by")
    serializer_class = AIGenerationHistorySerializer
    permission_classes = [IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=204)
