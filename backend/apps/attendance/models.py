from django.db import models

from apps.core.models import UIDModel


class Attendance(UIDModel):
    class Status(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        ABSENT = "ABSENT", "Absent"
        LATE = "LATE", "Late"
        HALF_DAY = "HALF_DAY", "Half Day"

    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="attendance_records")
    date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices)
    marked_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="marked_attendance")
    # Set once a section's attendance for this date has been confirmed (see
    # AttendanceViewSet.confirm_day) — from that point on, Teacher/Class
    # Teacher roles can no longer change it that day. Super Admin/Principal
    # can still override, same as they can for past-dated edits.
    is_locked = models.BooleanField(default=False)

    class Meta:
        unique_together = ("student", "date")
        ordering = ["-date"]

    def __str__(self):
        return f"{self.student} - {self.date} - {self.status}"


class PastAttendanceEditGrant(UIDModel):
    """A one-time permission slip letting a Teacher/Class Teacher edit an
    already-marked (past-dated) attendance record. Super Admin/Principal can
    always edit past attendance; everyone else needs an unused grant here,
    capped at 2 grants per teacher per rolling 6 months (enforced where
    grants are issued, not here — this model just tracks issued/used state).
    """

    teacher = models.ForeignKey("teachers.Teacher", on_delete=models.CASCADE, related_name="past_attendance_edit_grants")
    granted_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="granted_attendance_edits",
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)
    used_for_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-granted_at"]

    @property
    def is_used(self):
        return self.used_at is not None

    def __str__(self):
        status = f"used {self.used_for_date}" if self.is_used else "unused"
        return f"{self.teacher} - granted {self.granted_at:%Y-%m-%d} ({status})"
