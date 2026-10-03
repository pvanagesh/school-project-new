from rest_framework import serializers

from .models import (
    AIGenerationHistory,
    ClassStreamProfile,
    Combination,
    CommonRoom,
    ProfileSubject,
    SchoolClass,
    Section,
    SectionSubject,
    Subject,
    Timetable,
)


class SchoolClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolClass
        fields = "__all__"
        read_only_fields = ["uid"]


def validate_stream_and_combination(school_class, stream, combination, *, label="sections"):
    errors = {}
    if school_class and school_class.level in ("11", "12") and not stream:
        errors["stream"] = f"Stream is required for Class 11 and 12 {label}."
    if school_class and school_class.level not in ("11", "12") and stream:
        errors["stream"] = f"Stream only applies to Class 11 and 12 {label}."
    if combination and combination not in Combination.for_stream(stream, school_class.board if school_class else None):
        errors["combination"] = f"'{combination}' is not a valid combination for the {stream or 'selected'} stream."
    if errors:
        raise serializers.ValidationError(errors)


class SectionSerializer(serializers.ModelSerializer):
    class_teacher_name = serializers.SerializerMethodField()
    room_name = serializers.CharField(source="room.name", read_only=True, default=None)
    room_code = serializers.CharField(source="room.code", read_only=True, default=None)

    class Meta:
        model = Section
        fields = "__all__"
        read_only_fields = ["uid"]

    def get_class_teacher_name(self, obj):
        if not obj.class_teacher:
            return None
        return f"{obj.class_teacher.first_name} {obj.class_teacher.last_name}"

    def validate(self, attrs):
        school_class = attrs.get("school_class") or getattr(self.instance, "school_class", None)
        stream = attrs.get("stream") if "stream" in attrs else getattr(self.instance, "stream", None)
        combination = attrs.get("combination") if "combination" in attrs else getattr(self.instance, "combination", None)
        validate_stream_and_combination(school_class, stream, combination, label="sections")

        class_teacher = attrs.get("class_teacher") if "class_teacher" in attrs else getattr(self.instance, "class_teacher", None)
        if class_teacher:
            conflict = Section.objects.filter(class_teacher=class_teacher).exclude(pk=getattr(self.instance, "pk", None))
            if conflict.exists():
                existing = conflict.first()
                raise serializers.ValidationError(
                    {"class_teacher": f"{class_teacher.first_name} {class_teacher.last_name} is already the class teacher of {existing}."}
                )
        return attrs


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = "__all__"
        read_only_fields = ["uid"]


class CommonRoomSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True, default=None)

    class Meta:
        model = CommonRoom
        fields = "__all__"
        read_only_fields = ["uid"]


class ProfileSubjectSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = ProfileSubject
        fields = "__all__"
        read_only_fields = ["uid"]


class ClassStreamProfileSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    subjects = ProfileSubjectSerializer(many=True, read_only=True)

    class Meta:
        model = ClassStreamProfile
        fields = "__all__"
        read_only_fields = ["uid"]


class SectionSubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionSubject
        fields = "__all__"
        read_only_fields = ["uid"]


class TimetableSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = Timetable
        fields = "__all__"
        read_only_fields = ["uid"]

    def get_teacher_name(self, obj):
        return f"{obj.teacher.first_name} {obj.teacher.last_name}"

    def validate(self, attrs):
        instance = Timetable(**attrs)
        if self.instance:
            instance.pk = self.instance.pk
        instance.clean()
        return attrs


class AIGenerationHistorySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AIGenerationHistory
        fields = "__all__"
        read_only_fields = ["uid", "created_by", "created_at"]

    def get_created_by_name(self, obj):
        return obj.created_by.username if obj.created_by else None
