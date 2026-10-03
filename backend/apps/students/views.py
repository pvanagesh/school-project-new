from django.db.models.deletion import ProtectedError
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import DenyTeacherWrite
from apps.accounts.scoping import filter_classes_by_division
from apps.teachers.scoping import is_teacher_role, teacher_section_ids

from .models import Student
from .serializers import StudentSerializer


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated, DenyTeacherWrite]

    def get_queryset(self):
        qs = filter_classes_by_division(super().get_queryset(), self.request.user, prefix="current_class__")
        school_class = self.request.query_params.get("class")
        section = self.request.query_params.get("section")
        stream = self.request.query_params.get("stream")
        if school_class:
            qs = qs.filter(current_class_id=school_class)
        if section:
            qs = qs.filter(current_section_id=section)
        if stream:
            qs = qs.filter(stream=stream)
        if is_teacher_role(self.request.user):
            qs = qs.filter(current_section_id__in=teacher_section_ids(self.request.user))
        return qs

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as exc:
            blockers = sorted({obj.__class__.__name__ for obj in exc.protected_objects})
            return Response(
                {"detail": f"Cannot delete: still referenced by existing {', '.join(blockers)} record(s)."},
                status=400,
            )
