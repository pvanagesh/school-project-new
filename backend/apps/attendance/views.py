from datetime import date as date_cls
from datetime import time as time_cls
from datetime import timedelta

from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.scoping import filter_classes_by_division
from apps.students.models import Student
from apps.teachers.scoping import (
    day_code_for_date,
    is_teacher_role,
    teacher_class_teacher_section_ids,
    teacher_is_class_teacher_of,
    teacher_period1_section_ids,
    teacher_profile_of,
    teacher_section_ids,
)

from .models import Attendance, PastAttendanceEditGrant
from .serializers import AttendanceSerializer, PastAttendanceEditGrantSerializer

ADMIN_ROLES = ("SUPER_ADMIN", "PRINCIPAL")
GRANT_LIMIT_PER_WINDOW = 2
GRANT_WINDOW_DAYS = 182  # ~6 months

# The daily attendance-marking window matches school timings: 9:00 AM to
# 5:00 PM. A Class Teacher can still explicitly confirm/lock a section
# earlier via confirm_day; if nobody does, today's attendance auto-locks the
# moment the window closes at 5:00 PM, with no cron job or scheduled task
# needed — it's just evaluated fresh on every request against the current
# time. Only applies to *today*; a past date is governed by the separate
# PastAttendanceEditGrant flow instead.
SCHOOL_DAY_START = time_cls(9, 0)
SCHOOL_DAY_END = time_cls(17, 0)


def _outside_school_hours_today(for_date):
    if for_date != date_cls.today():
        return False
    now = timezone.localtime().time()
    return now < SCHOOL_DAY_START or now >= SCHOOL_DAY_END


def _is_admin_role(user):
    role = getattr(user, "role", None)
    return bool(role and role.name in ADMIN_ROLES)


def _teacher_can_mark_section(user, section_id, for_date):
    """A Teacher/Class Teacher may mark or edit a section's daily attendance
    if either: she is that section's Class Teacher, or, per the timetable,
    she has that section's Period 1 on the given date's weekday — whichever
    teacher takes first period also gets to take attendance. Admin roles
    (and non-teacher users generally) are unrestricted here."""
    if not is_teacher_role(user):
        return True
    if teacher_is_class_teacher_of(user, section_id):
        return True
    allowed = teacher_period1_section_ids(user, day_code_for_date(for_date))
    return section_id in allowed


def _section_date_is_locked(section_id, for_date):
    """True once a section's attendance for this date has been confirmed
    (see confirm_day), or once today's 9am-5pm marking window has closed —
    from then on Teacher/Class Teacher roles can't change it that day at
    all, no grant process involved. Callers already gate this behind
    `not _is_admin_role(...)`, so Super Admin/Principal bypass both the
    explicit-confirm lock and this school-hours auto-lock the same way."""
    if _outside_school_hours_today(for_date):
        return True
    return Attendance.objects.filter(
        student__current_section_id=section_id, date=for_date, is_locked=True
    ).exists()


def _consume_grant_for_past_edit(user, edit_date):
    """Editing attendance for a date in the past requires an unused grant
    for Teacher/Class Teacher roles — Super Admin/Principal bypass this
    entirely. Returns None on success, or an error string to reject with."""
    if edit_date >= date_cls.today():
        return None
    if _is_admin_role(user):
        return None
    if not is_teacher_role(user):
        return "Only Super Admin/Principal can edit past attendance."

    teacher = teacher_profile_of(user)
    if not teacher:
        return "Only Super Admin/Principal can edit past attendance."

    grant = PastAttendanceEditGrant.objects.filter(teacher=teacher, used_at__isnull=True).order_by("granted_at").first()
    if not grant:
        return "Editing past attendance requires a grant from the Principal. None available."

    grant.used_at = timezone.now()
    grant.used_for_date = edit_date
    grant.save(update_fields=["used_at", "used_for_date"])
    return None


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related("student", "marked_by").all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = filter_classes_by_division(super().get_queryset(), self.request.user, prefix="student__current_class__")
        student = self.request.query_params.get("student")
        date = self.request.query_params.get("date")
        section = self.request.query_params.get("section")
        if student:
            qs = qs.filter(student_id=student)
        if date:
            qs = qs.filter(date=date)
        if section:
            qs = qs.filter(student__current_section_id=section)
        if is_teacher_role(self.request.user):
            visible_sections = teacher_section_ids(self.request.user) | teacher_class_teacher_section_ids(
                self.request.user
            )
            qs = qs.filter(student__current_section_id__in=visible_sections)
        return qs

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied

        student = serializer.validated_data.get("student")
        record_date = serializer.validated_data.get("date")
        if student and record_date:
            section_id = student.current_section_id
            if not _is_admin_role(self.request.user) and _section_date_is_locked(section_id, record_date):
                raise PermissionDenied(
                    "Attendance for this day has already been confirmed, or today's 9am-5pm marking window "
                    "has closed, and can no longer be changed."
                )
            if not _teacher_can_mark_section(self.request.user, section_id, record_date):
                raise PermissionDenied(
                    "You can only mark attendance for a section where you have Period 1 that day, "
                    "or a section you are the Class Teacher of."
                )
        serializer.save(marked_by=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        section_id = instance.student.current_section_id
        if not _is_admin_role(request.user) and _section_date_is_locked(section_id, instance.date):
            return Response(
                {
                    "detail": "Attendance for this day has already been confirmed, or today's 9am-5pm marking "
                    "window has closed, and can no longer be changed."
                },
                status=403,
            )
        if not _teacher_can_mark_section(request.user, section_id, instance.date):
            return Response(
                {
                    "detail": "You can only edit attendance for a section where you have Period 1 that day, "
                    "or a section you are the Class Teacher of."
                },
                status=403,
            )
        error = _consume_grant_for_past_edit(request.user, instance.date)
        if error:
            return Response({"detail": error}, status=403)
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=["post"])
    def bulk_mark(self, request):
        date = request.data.get("date")
        entries = request.data.get("entries", [])
        if not date or not entries:
            return Response({"detail": "date and entries are required."}, status=400)

        parsed_date = date_cls.fromisoformat(date)
        student_ids = [entry.get("student") for entry in entries if entry.get("student")]

        if is_teacher_role(request.user):
            allowed_sections = teacher_period1_section_ids(request.user, day_code_for_date(parsed_date))
            class_teacher_sections = {
                sid
                for sid in Student.objects.filter(id__in=student_ids).values_list("current_section_id", flat=True)
                if teacher_is_class_teacher_of(request.user, sid)
            }
            out_of_scope = Student.objects.filter(id__in=student_ids).exclude(
                current_section_id__in=allowed_sections | class_teacher_sections
            )
            if out_of_scope.exists():
                return Response(
                    {
                        "detail": "You can only mark attendance for a section where you have Period 1 that day, "
                        "or a section you are the Class Teacher of."
                    },
                    status=403,
                )

        if not _is_admin_role(request.user):
            locked = _outside_school_hours_today(parsed_date) or Attendance.objects.filter(
                student_id__in=student_ids, date=parsed_date, is_locked=True
            ).exists()
            if locked:
                return Response(
                    {
                        "detail": "Attendance for this day has already been confirmed, or today's 9am-5pm "
                        "marking window has closed, and can no longer be changed."
                    },
                    status=403,
                )

        if parsed_date < date_cls.today():
            error = _consume_grant_for_past_edit(request.user, parsed_date)
            if error:
                return Response({"detail": error}, status=403)

        saved = []
        for entry in entries:
            student_id = entry.get("student")
            status_value = entry.get("status")
            if not student_id or not status_value:
                continue
            obj, _ = Attendance.objects.update_or_create(
                student_id=student_id,
                date=date,
                defaults={"status": status_value, "marked_by": request.user},
            )
            saved.append(obj)

        serializer = self.get_serializer(saved, many=True)
        return Response(serializer.data, status=200)

    @action(detail=False, methods=["post"])
    def confirm_day(self, request):
        """Locks a section's attendance for a date so it can no longer be
        changed that day (Admin/Principal can still override elsewhere).
        Called once the marking teacher is done, after bulk_mark has saved
        every student — a separate, explicit step so paging through a long
        roster across several bulk_mark calls doesn't lock itself out
        partway through."""
        section_id = request.data.get("section")
        date = request.data.get("date")
        if not section_id or not date:
            return Response({"detail": "section and date are required."}, status=400)

        parsed_date = date_cls.fromisoformat(date)
        if not _teacher_can_mark_section(request.user, int(section_id), parsed_date):
            return Response(
                {
                    "detail": "You can only confirm attendance for a section where you have Period 1 that day, "
                    "or a section you are the Class Teacher of."
                },
                status=403,
            )

        updated = Attendance.objects.filter(student__current_section_id=section_id, date=parsed_date).update(
            is_locked=True
        )
        return Response({"detail": f"Attendance confirmed and locked for {updated} student(s).", "locked_count": updated})


class PastAttendanceEditGrantViewSet(viewsets.ModelViewSet):
    queryset = PastAttendanceEditGrant.objects.select_related("teacher", "granted_by").all()
    serializer_class = PastAttendanceEditGrantSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        teacher = self.request.query_params.get("teacher")
        if teacher:
            qs = qs.filter(teacher_id=teacher)
        return qs

    def perform_create(self, serializer):
        teacher = serializer.validated_data["teacher"]
        window_start = timezone.now() - timedelta(days=GRANT_WINDOW_DAYS)
        recent_count = PastAttendanceEditGrant.objects.filter(teacher=teacher, granted_at__gte=window_start).count()
        if recent_count >= GRANT_LIMIT_PER_WINDOW:
            from rest_framework.exceptions import ValidationError

            raise ValidationError(
                f"{teacher} has already received {GRANT_LIMIT_PER_WINDOW} past-attendance edit grants "
                f"in the last 6 months."
            )
        serializer.save(granted_by=self.request.user)
