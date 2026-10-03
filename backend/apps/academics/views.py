from django.db.models.deletion import ProtectedError
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import DenyTeacherWrite
from apps.accounts.scoping import filter_classes_by_division
from apps.teachers.scoping import is_teacher_role, teacher_profile_of

from .models import ClassStreamProfile, CommonRoom, ProfileSubject, SchoolClass, Section, SectionSubject, Subject, Timetable
from .serializers import (
    ClassStreamProfileSerializer,
    CommonRoomSerializer,
    ProfileSubjectSerializer,
    SchoolClassSerializer,
    SectionSerializer,
    SectionSubjectSerializer,
    SubjectSerializer,
    TimetableSerializer,
)


def _destroy_or_protected_error(viewset, request, *args, **kwargs):
    try:
        return viewsets.ModelViewSet.destroy(viewset, request, *args, **kwargs)
    except ProtectedError as exc:
        blockers = sorted({obj.__class__.__name__ for obj in exc.protected_objects})
        return Response(
            {"detail": f"Cannot delete: still referenced by existing {', '.join(blockers)} record(s)."},
            status=400,
        )


class SchoolClassViewSet(viewsets.ModelViewSet):
    queryset = SchoolClass.objects.all()
    serializer_class = SchoolClassSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return filter_classes_by_division(super().get_queryset(), self.request.user)

    def destroy(self, request, *args, **kwargs):
        return _destroy_or_protected_error(self, request, *args, **kwargs)


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = filter_classes_by_division(super().get_queryset(), self.request.user, prefix="school_class__")
        stream = self.request.query_params.get("stream")
        if stream:
            qs = qs.filter(stream=stream)
        return qs

    def destroy(self, request, *args, **kwargs):
        return _destroy_or_protected_error(self, request, *args, **kwargs)


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        return _destroy_or_protected_error(self, request, *args, **kwargs)


class CommonRoomViewSet(viewsets.ModelViewSet):
    queryset = CommonRoom.objects.all()
    serializer_class = CommonRoomSerializer
    permission_classes = [IsAuthenticated]


class ClassStreamProfileViewSet(viewsets.ModelViewSet):
    queryset = ClassStreamProfile.objects.select_related("school_class").prefetch_related("subjects__subject")
    serializer_class = ClassStreamProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return filter_classes_by_division(super().get_queryset(), self.request.user, prefix="school_class__")


class ProfileSubjectViewSet(viewsets.ModelViewSet):
    queryset = ProfileSubject.objects.select_related("subject", "profile")
    serializer_class = ProfileSubjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return filter_classes_by_division(
            super().get_queryset(), self.request.user, prefix="profile__school_class__"
        )


class SectionSubjectViewSet(viewsets.ModelViewSet):
    queryset = SectionSubject.objects.all()
    serializer_class = SectionSubjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return filter_classes_by_division(
            super().get_queryset(), self.request.user, prefix="section__school_class__"
        )


class TimetableViewSet(viewsets.ModelViewSet):
    queryset = Timetable.objects.select_related("subject", "teacher").all()
    serializer_class = TimetableSerializer
    permission_classes = [IsAuthenticated, DenyTeacherWrite]

    def get_queryset(self):
        qs = filter_classes_by_division(super().get_queryset(), self.request.user, prefix="section__school_class__")
        section = self.request.query_params.get("section")
        if section:
            qs = qs.filter(section=section)
        elif is_teacher_role(self.request.user):
            teacher = teacher_profile_of(self.request.user)
            qs = qs.filter(teacher=teacher) if teacher else qs.none()
        return qs
