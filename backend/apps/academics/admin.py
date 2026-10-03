from django.contrib import admin

from .models import ClassStreamProfile, ProfileSubject, SchoolClass, Section, SectionSubject, Subject, Timetable


@admin.register(SchoolClass)
class SchoolClassAdmin(admin.ModelAdmin):
    list_display = ("name", "level")


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("school_class", "name", "stream", "combination")
    list_filter = ("school_class", "stream", "combination")


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("name", "language_tier", "co_scholastic_category")
    list_filter = ("language_tier", "co_scholastic_category")


@admin.register(ClassStreamProfile)
class ClassStreamProfileAdmin(admin.ModelAdmin):
    list_display = ("school_class", "stream", "combination")
    list_filter = ("school_class", "stream")


@admin.register(ProfileSubject)
class ProfileSubjectAdmin(admin.ModelAdmin):
    list_display = ("profile", "subject", "category")
    list_filter = ("category",)


@admin.register(SectionSubject)
class SectionSubjectAdmin(admin.ModelAdmin):
    list_display = ("section", "subject")


@admin.register(Timetable)
class TimetableAdmin(admin.ModelAdmin):
    list_display = ("section", "day_of_week", "period", "subject", "teacher", "classroom")
    list_filter = ("day_of_week", "section")
