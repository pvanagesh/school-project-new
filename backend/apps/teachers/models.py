from django.db import models

from apps.core.models import UIDModel


class Teacher(UIDModel):
    teacher_id = models.CharField(max_length=20, unique=True)
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="teacher_profile")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    qualification = models.CharField(max_length=200)
    experience_years = models.PositiveSmallIntegerField(default=0)
    subject_specialization = models.CharField(max_length=200)
    contact = models.CharField(max_length=20)
    joining_date = models.DateField()

    def __str__(self):
        return f"{self.teacher_id} - {self.first_name} {self.last_name}"
