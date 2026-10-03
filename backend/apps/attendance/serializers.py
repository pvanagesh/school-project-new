from rest_framework import serializers

from .models import Attendance, PastAttendanceEditGrant


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    marked_by_username = serializers.CharField(source="marked_by.username", read_only=True)

    class Meta:
        model = Attendance
        fields = "__all__"
        # is_locked can only be set server-side, by AttendanceViewSet.confirm_day.
        read_only_fields = ["uid", "marked_by", "is_locked"]

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"


class PastAttendanceEditGrantSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    granted_by_username = serializers.CharField(source="granted_by.username", read_only=True, default=None)
    is_used = serializers.BooleanField(read_only=True)

    class Meta:
        model = PastAttendanceEditGrant
        fields = "__all__"
        read_only_fields = ["uid", "granted_by", "granted_at", "used_at", "used_for_date"]

    def get_teacher_name(self, obj):
        return f"{obj.teacher.first_name} {obj.teacher.last_name}"
