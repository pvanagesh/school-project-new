from django.contrib import admin

from .models import AcademicYear, SchoolProfile


@admin.register(SchoolProfile)
class SchoolProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "udise_code", "board", "state", "district")
    readonly_fields = ("uid",)


@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "end_date", "is_active")
    readonly_fields = ("uid",)
