from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ObjectDoesNotExist, ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import AuditLog, Permission, Role, User


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = "__all__"


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = "__all__"
        read_only_fields = ["uid", "is_system"]


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True, default=None)
    password = serializers.CharField(write_only=True, required=False, style={"input_type": "password"})
    # Numeric Teacher.id (NOT the human-readable teacher_id string like
    # "EMP011") — the frontend's class-teacher checks compare this against
    # Section.class_teacher, which is also a Teacher FK. None for any User
    # with no linked Teacher profile (Admin, Principal, Accountant, ...).
    teacher_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "uid", "username", "email", "first_name", "last_name",
            "role", "role_name", "phone", "is_active", "date_joined", "password", "teacher_id",
            "assigned_board", "assigned_group",
        ]
        read_only_fields = ["uid", "date_joined"]

    def get_teacher_id(self, obj):
        try:
            return obj.teacher_profile.id
        except ObjectDoesNotExist:
            return None

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "This field is required when creating a user."})
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = "__all__"
        read_only_fields = ["created_at"]


class PasswordResetRequestSerializer(serializers.Serializer):
    """Accepts either a username or an email — whichever the person still
    remembers. Deliberately has no notion of "not found": the view always
    responds the same way either way, so this endpoint can't be used to
    probe which usernames/emails exist in the system."""

    username_or_email = serializers.CharField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value
