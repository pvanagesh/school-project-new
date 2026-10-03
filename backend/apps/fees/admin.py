from django.contrib import admin

from .models import FeeCategory, FeeStructure, Payment, PaymentAdjustment


@admin.register(FeeCategory)
class FeeCategoryAdmin(admin.ModelAdmin):
    list_display = ("name",)


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ("school_class", "stream", "category", "amount", "academic_year")
    list_filter = ("school_class", "stream", "academic_year")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("uid", "student", "amount", "mode", "date", "recorded_by")
    list_filter = ("mode", "date")
    readonly_fields = [f.name for f in Payment._meta.fields]

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PaymentAdjustment)
class PaymentAdjustmentAdmin(admin.ModelAdmin):
    list_display = ("payment", "adjustment_amount", "created_by", "created_at")
