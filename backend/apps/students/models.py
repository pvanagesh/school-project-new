from django.db import models

from apps.academics.models import Combination, Stream
from apps.core.models import UIDModel


class Student(UIDModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        PROMOTED = "PROMOTED", "Promoted"
        TRANSFERRED = "TRANSFERRED", "Transferred"
        SUSPENDED = "SUSPENDED", "Suspended"
        WITHDRAWN = "WITHDRAWN", "Withdrawn"

    student_id = models.CharField(max_length=20, unique=True)
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, null=True, blank=True, related_name="student_profile")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    dob = models.DateField()
    gender = models.CharField(max_length=20)
    admission_date = models.DateField()
    current_class = models.ForeignKey("academics.SchoolClass", on_delete=models.PROTECT, related_name="students")
    current_section = models.ForeignKey("academics.Section", on_delete=models.PROTECT, related_name="students")
    stream = models.CharField(max_length=20, choices=Stream.choices, null=True, blank=True)
    combination = models.CharField(max_length=30, choices=Combination.choices, null=True, blank=True)
    stream_locked = models.BooleanField(default=False)
    parent_name = models.CharField(max_length=150)
    parent_contact = models.CharField(max_length=20)
    address = models.TextField()
    medical_info = models.TextField(blank=True)
    previous_school = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    roll_number = models.CharField(max_length=20, blank=True, default="")

    def __str__(self):
        return f"{self.student_id} - {self.first_name} {self.last_name}"
