from django.contrib import admin

from .models import AssessmentConfig, Exam, MarksEntry, SubjectMarksConfig


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ("name", "term", "academic_year", "school_class")
    list_filter = ("academic_year", "school_class")


@admin.register(AssessmentConfig)
class AssessmentConfigAdmin(admin.ModelAdmin):
    list_display = ("school_class", "mode")


@admin.register(SubjectMarksConfig)
class SubjectMarksConfigAdmin(admin.ModelAdmin):
    list_display = ("subject", "school_class", "max_theory", "max_internal")


@admin.register(MarksEntry)
class MarksEntryAdmin(admin.ModelAdmin):
    list_display = ("student", "subject", "exam", "theory_marks", "internal_marks", "grade", "is_published")
    list_filter = ("exam", "is_published")
