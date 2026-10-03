from django.db import models

from apps.academics.models import Stream
from apps.core.models import UIDModel


class FeeCategory(UIDModel):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name_plural = "Fee Categories"

    def __str__(self):
        return self.name


class FeeStructure(UIDModel):
    school_class = models.ForeignKey("academics.SchoolClass", on_delete=models.CASCADE, related_name="fee_structures")
    stream = models.CharField(max_length=20, choices=Stream.choices, null=True, blank=True)
    category = models.ForeignKey(FeeCategory, on_delete=models.CASCADE, related_name="fee_structures")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    academic_year = models.ForeignKey("core.AcademicYear", on_delete=models.CASCADE, related_name="fee_structures")

    class Meta:
        unique_together = ("school_class", "stream", "category", "academic_year")

    def __str__(self):
        return f"{self.school_class} - {self.category} - {self.amount}"


class Payment(UIDModel):
    class Mode(models.TextChoices):
        CASH = "CASH", "Cash"
        UPI = "UPI", "UPI"
        CHEQUE = "CHEQUE", "Cheque"

    student = models.ForeignKey("students.Student", on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    mode = models.CharField(max_length=10, choices=Mode.choices)
    reference_number = models.CharField(max_length=100, blank=True)
    date = models.DateField()
    recorded_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="recorded_payments")

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"Receipt {self.uid} - {self.student} - {self.amount}"


class PaymentAdjustment(UIDModel):
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="adjustments")
    adjustment_amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField()
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="payment_adjustments")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Adjustment on {self.payment} - {self.adjustment_amount}"
