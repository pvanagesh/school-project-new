from django.db import models

from apps.core.models import UIDModel


class Exam(UIDModel):
    name = models.CharField(max_length=100)
    term = models.CharField(max_length=50)
    academic_year = models.ForeignKey("core.AcademicYear", on_delete=models.CASCADE, related_name="exams")
    school_class = models.ForeignKey("academics.SchoolClass", on_delete=models.CASCADE, related_name="exams")

    class Meta:
        unique_together = ("name", "academic_year", "school_class")

    def __str__(self):
        return f"{self.name} - {self.school_class} ({self.academic_year})"


class AssessmentConfig(UIDModel):
    class Mode(models.TextChoices):
        CCE_GRADE = "CCE_GRADE", "CCE Grade (LKG-10)"
        BOARD_MARKS = "BOARD_MARKS", "Board Marks (11-12)"

    school_class = models.OneToOneField("academics.SchoolClass", on_delete=models.CASCADE, related_name="assessment_config")
    mode = models.CharField(max_length=20, choices=Mode.choices)

    def __str__(self):
        return f"{self.school_class} - {self.mode}"


class SubjectMarksConfig(UIDModel):
    subject = models.ForeignKey("academics.Subject", on_delete=models.CASCADE, related_name="marks_configs")
    school_class = models.ForeignKey("academics.SchoolClass", on_delete=models.CASCADE, related_name="subject_marks_configs")
    max_theory = models.PositiveSmallIntegerField(default=80)
    max_internal = models.PositiveSmallIntegerField(default=20)

    class Meta:
        unique_together = ("subject", "school_class")

    def __str__(self):
        return f"{self.subject} - {self.school_class} ({self.max_theory}+{self.max_internal})"


class MarksEntry(UIDModel):
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="marks_entries")
    subject = models.ForeignKey("academics.Subject", on_delete=models.CASCADE, related_name="marks_entries")
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="marks_entries")
    theory_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    internal_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    grade = models.CharField(max_length=5, null=True, blank=True)
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="published_marks")

    class Meta:
        unique_together = ("student", "subject", "exam")

    def __str__(self):
        return f"{self.student} - {self.subject} - {self.exam}"
