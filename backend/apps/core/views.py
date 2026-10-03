from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsSuperAdminOrReadOnly
from apps.accounts.scoping import user_division

from .models import AcademicYear, SchoolProfile
from .serializers import AcademicYearSerializer, SchoolProfileSerializer


class SchoolProfileViewSet(viewsets.ModelViewSet):
    """One profile per division (board x junior/senior group) — up to 4
    total. create() is blocked only if that exact division already has a
    row; a division-scoped account (Principal/Teacher/Class Teacher/
    Accountant) only ever sees their own division's profile here, same as
    everywhere else in the app."""

    serializer_class = SchoolProfileSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOrReadOnly]

    def get_queryset(self):
        qs = SchoolProfile.objects.all()
        division = user_division(self.request.user)
        if division is None:
            return qs
        if division is False:
            return qs.none()
        board, group = division
        return qs.filter(board=board, group=group)

    def create(self, request, *args, **kwargs):
        board = request.data.get("board")
        group = request.data.get("group")
        if SchoolProfile.objects.filter(board=board, group=group).exists():
            return Response(
                {"detail": "A school profile already exists for this division. Edit it instead of creating a new one."},
                status=400,
            )
        return super().create(request, *args, **kwargs)


class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOrReadOnly]

    def destroy(self, request, *args, **kwargs):
        year = self.get_object()
        exam_count = year.exams.count()
        fee_count = year.fee_structures.count()
        if exam_count or fee_count:
            parts = []
            if exam_count:
                parts.append(f"{exam_count} exam(s)")
            if fee_count:
                parts.append(f"{fee_count} fee structure(s)")
            return Response(
                {"detail": f"Cannot delete this academic year: {' and '.join(parts)} still reference it."},
                status=400,
            )
        return super().destroy(request, *args, **kwargs)
