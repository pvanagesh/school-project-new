from rest_framework import serializers

from .models import AssessmentConfig, Exam, MarksEntry, SubjectMarksConfig


class ExamSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    school_class_name = serializers.CharField(source="school_class.name", read_only=True)

    class Meta:
        model = Exam
        fields = "__all__"
        read_only_fields = ["uid"]


class AssessmentConfigSerializer(serializers.ModelSerializer):
    school_class_name = serializers.CharField(source="school_class.name", read_only=True)

    class Meta:
        model = AssessmentConfig
        fields = "__all__"
        read_only_fields = ["uid"]


class SubjectMarksConfigSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    school_class_name = serializers.CharField(source="school_class.name", read_only=True)

    class Meta:
        model = SubjectMarksConfig
        fields = "__all__"
        read_only_fields = ["uid"]


class MarksEntrySerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    exam_name = serializers.CharField(source="exam.name", read_only=True)
    published_by_username = serializers.CharField(source="published_by.username", read_only=True)

    class Meta:
        model = MarksEntry
        fields = "__all__"
        read_only_fields = ["uid", "is_published", "published_at", "published_by"]

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"
