from rest_framework import serializers

from apps.academics.serializers import validate_stream_and_combination

from .models import Student


class StudentSerializer(serializers.ModelSerializer):
    current_class_name = serializers.CharField(source="current_class.name", read_only=True)
    current_section_name = serializers.CharField(source="current_section.name", read_only=True)

    class Meta:
        model = Student
        fields = "__all__"
        read_only_fields = ["uid", "stream_locked"]

    def validate(self, attrs):
        school_class = attrs.get("current_class") or getattr(self.instance, "current_class", None)
        stream = attrs.get("stream") if "stream" in attrs else getattr(self.instance, "stream", None)
        combination = attrs.get("combination") if "combination" in attrs else getattr(self.instance, "combination", None)
        validate_stream_and_combination(school_class, stream, combination, label="students")
        return attrs
