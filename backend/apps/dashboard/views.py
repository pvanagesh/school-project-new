from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import SchoolClass, Section, Stream
from apps.accounts.scoping import filter_classes_by_division, filter_staff_by_division
from apps.attendance.models import Attendance
from apps.core.models import AcademicYear
from apps.exams.models import Exam
from apps.fees.models import Payment
from apps.students.models import Student
from apps.teachers.models import Teacher


class DashboardView(APIView):
    """Aggregate stats for the Super Admin dashboard. A division-scoped
    staff user (Principal/Teacher/Class Teacher/Accountant) sees the same
    payload shape, but every count is narrowed to their own division —
    Super Admin still sees school-wide totals."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = getattr(getattr(request.user, "role", None), "name", None)
        today = timezone.localdate()

        students = filter_classes_by_division(Student.objects.all(), request.user, prefix="current_class__")
        classes = filter_classes_by_division(SchoolClass.objects.all(), request.user)
        sections = filter_classes_by_division(Section.objects.all(), request.user, prefix="school_class__")
        teachers = filter_staff_by_division(Teacher.objects.all(), request.user, prefix="user__")
        attendance_qs = filter_classes_by_division(
            Attendance.objects.all(), request.user, prefix="student__current_class__"
        )
        payments = filter_classes_by_division(Payment.objects.all(), request.user, prefix="student__current_class__")
        exams_scope = filter_classes_by_division(Exam.objects.all(), request.user, prefix="school_class__")

        today_attendance = {
            status_value: attendance_qs.filter(date=today, status=status_value).count()
            for status_value, _ in Attendance.Status.choices
        }

        month_start = today.replace(day=1)
        fees_this_month = (
            payments.filter(date__gte=month_start, date__lte=today).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )

        active_year = AcademicYear.objects.filter(is_active=True).first()
        exams_qs = exams_scope.filter(academic_year=active_year) if active_year else exams_scope

        data = {
            "role": role,
            "total_students": students.count(),
            "total_teachers": teachers.count(),
            "total_classes": classes.count(),
            "total_sections": sections.count(),
            "students_by_stream": {
                stream_value: students.filter(stream=stream_value).count()
                for stream_value, _ in Stream.choices
            },
            "today_attendance": today_attendance,
            "fees_collected_this_month": str(fees_this_month),
            "total_exams": exams_qs.count(),
        }
        return Response(data)

    
