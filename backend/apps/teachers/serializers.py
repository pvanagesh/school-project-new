from rest_framework import serializers

from apps.accounts.models import Role, User

from .models import Teacher


class TeacherSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, style={"input_type": "password"})
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    # Which division to create this teacher's account in — sent only when
    # creating (the Teachers page pre-fills these from whichever Board/Group
    # tab is active), never used on update (a teacher's division is changed
    # from Users & Roles, not here).
    assigned_board = serializers.ChoiceField(choices=["CBSE", "SSC"], write_only=True, required=False)
    assigned_group = serializers.ChoiceField(choices=["JUNIOR", "SENIOR"], write_only=True, required=False)
    user_username = serializers.CharField(source="user.username", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    # Which division this teacher's account is assigned to (Users & Roles) —
    # exposed here so the Teachers page can group/filter by CBSE/SSC and
    # junior/senior without a second API call per teacher.
    user_assigned_board = serializers.CharField(source="user.assigned_board", read_only=True)
    user_assigned_group = serializers.CharField(source="user.assigned_group", read_only=True)

    class Meta:
        model = Teacher
        fields = "__all__"
        read_only_fields = ["uid", "user"]

    def create(self, validated_data):
        username = validated_data.pop("username", None)
        password = validated_data.pop("password", None)
        email = validated_data.pop("email", "")
        assigned_board = validated_data.pop("assigned_board", None)
        assigned_group = validated_data.pop("assigned_group", None)
        if not username or not password:
            raise serializers.ValidationError(
                {"username": "Username and password are required when creating a teacher."}
            )
        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError({"username": "A user with this username already exists."})

        role = Role.objects.filter(name="TEACHER").first()
        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            role=role,
            phone=validated_data.get("contact", ""),
            assigned_board=assigned_board,
            assigned_group=assigned_group,
        )
        return Teacher.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("username", None)
        validated_data.pop("password", None)
        validated_data.pop("email", None)
        validated_data.pop("assigned_board", None)
        validated_data.pop("assigned_group", None)
        return super().update(instance, validated_data)
