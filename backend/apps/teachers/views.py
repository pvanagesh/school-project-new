from django.db.models.deletion import ProtectedError
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.scoping import filter_staff_by_division

from .models import Teacher
from .serializers import TeacherSerializer


class MyTeacherProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        teacher = Teacher.objects.select_related("user").filter(user=request.user).first()
        if not teacher:
            return Response({"detail": "No teacher profile is linked to this account."}, status=404)
        return Response(TeacherSerializer(teacher).data)


class TeacherViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.select_related("user").all()
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # A Teacher's own division lives on their linked User account, not
        # on the Teacher row itself — filter by the other user's tags
        # directly rather than by a class relation.
        return filter_staff_by_division(super().get_queryset(), self.request.user, prefix="user__")

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as exc:
            blockers = sorted({obj.__class__.__name__ for obj in exc.protected_objects})
            return Response(
                {"detail": f"Cannot delete: still referenced by existing {', '.join(blockers)} record(s)."},
                status=400,
            )
