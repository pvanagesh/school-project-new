from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsAdminOrAccountantForWrite
from apps.accounts.scoping import filter_classes_by_division

from .models import FeeCategory, FeeStructure, Payment, PaymentAdjustment
from .serializers import (
    FeeCategorySerializer,
    FeeStructureSerializer,
    PaymentAdjustmentSerializer,
    PaymentSerializer,
)


class FeeCategoryViewSet(viewsets.ModelViewSet):
    queryset = FeeCategory.objects.all()
    serializer_class = FeeCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminOrAccountantForWrite]


class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = FeeStructure.objects.select_related("school_class", "category", "academic_year").all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAccountantForWrite]

    def get_queryset(self):
        qs = filter_classes_by_division(super().get_queryset(), self.request.user, prefix="school_class__")
        school_class = self.request.query_params.get("class")
        stream = self.request.query_params.get("stream")
        if school_class:
            qs = qs.filter(school_class_id=school_class)
        if stream:
            qs = qs.filter(stream=stream)
        return qs


class PaymentViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Receipts are immutable: create + read only, no update/delete route."""

    queryset = Payment.objects.select_related("student", "recorded_by").all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAccountantForWrite]

    def get_queryset(self):
        qs = filter_classes_by_division(super().get_queryset(), self.request.user, prefix="student__current_class__")
        student = self.request.query_params.get("student")
        if student:
            qs = qs.filter(student_id=student)
        return qs

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)


class PaymentAdjustmentViewSet(viewsets.ModelViewSet):
    queryset = PaymentAdjustment.objects.select_related("payment__student", "created_by").all()
    serializer_class = PaymentAdjustmentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAccountantForWrite]

    def get_queryset(self):
        return filter_classes_by_division(
            super().get_queryset(), self.request.user, prefix="payment__student__current_class__"
        )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
