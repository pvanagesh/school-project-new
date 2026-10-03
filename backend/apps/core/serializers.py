from rest_framework import serializers

from .models import AcademicYear, SchoolProfile


class SchoolProfileSerializer(serializers.ModelSerializer):
    # Declared explicitly (choices restricted so a typo here can never save
    # junk into the DB) even though the model already carries the same
    # choices — board/group together pick which of the school's 4
    # divisions this profile row belongs to.
    board = serializers.ChoiceField(choices=[("CBSE", "CBSE"), ("SSC", "SSC / State Board")])
    group = serializers.ChoiceField(choices=[("JUNIOR", "Classes 1-10 (School)"), ("SENIOR", "11th & 12th (College)")])

    class Meta:
        model = SchoolProfile
        fields = "__all__"
        read_only_fields = ["uid", "state"]


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = "__all__"
        read_only_fields = ["uid"]

    def create(self, validated_data):
        instance = super().create(validated_data)
        if instance.is_active:
            AcademicYear.objects.exclude(pk=instance.pk).update(is_active=False)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        if instance.is_active:
            AcademicYear.objects.exclude(pk=instance.pk).update(is_active=False)
        return instance
