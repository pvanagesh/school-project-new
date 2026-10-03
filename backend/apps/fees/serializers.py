from rest_framework import serializers

from .models import FeeCategory, FeeStructure, Payment, PaymentAdjustment


class FeeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeCategory
        fields = "__all__"
        read_only_fields = ["uid"]


class FeeStructureSerializer(serializers.ModelSerializer):
    school_class_name = serializers.CharField(source="school_class.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)

    class Meta:
        model = FeeStructure
        fields = "__all__"
        read_only_fields = ["uid"]


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_id_code = serializers.CharField(source="student.student_id", read_only=True)
    recorded_by_username = serializers.CharField(source="recorded_by.username", read_only=True)

    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["uid", "recorded_by"]

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"


class PaymentAdjustmentSerializer(serializers.ModelSerializer):
    payment_student_name = serializers.SerializerMethodField()
    payment_amount = serializers.DecimalField(source="payment.amount", max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = PaymentAdjustment
        fields = "__all__"
        read_only_fields = ["uid", "created_at", "created_by"]

    def get_payment_student_name(self, obj):
        return f"{obj.payment.student.first_name} {obj.payment.student.last_name}"
