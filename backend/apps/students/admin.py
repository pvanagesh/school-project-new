from django.contrib import admin

from .models import Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("student_id", "first_name", "last_name", "current_class", "current_section", "stream", "status")
    list_filter = ("current_class", "stream", "status")
    search_fields = ("student_id", "first_name", "last_name")
