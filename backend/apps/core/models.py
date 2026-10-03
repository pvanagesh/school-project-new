import uuid

from django.core.validators import RegexValidator
from django.db import models


class UIDModel(models.Model):
    """Abstract base giving every table a public, non-sequential identifier."""

    uid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)

    class Meta:
        abstract = True


udise_validator = RegexValidator(
    regex=r"^\d{11}$",
    message="UDISE+ code must be exactly 11 digits.",
)


class SchoolProfile(UIDModel):
    """The school's affiliation/registration details — now one row per
    division (board x junior/senior group), up to 4 total, matching the
    same CBSE School / CBSE College / SSC School / SSC College split used
    everywhere else (Classes, Teachers, Students). Before the 4-division
    split there was only ever one row for the whole school; `board` existed
    but was fixed/uneditable since there was nothing to distinguish. Real
    schools generally do need this split anyway — CBSE affiliation is
    granted separately for "Secondary" (up to 10) and "Senior Secondary"
    (11-12), and a state-board college can be a distinct institution from
    its school with its own UDISE+ code."""

    class Board(models.TextChoices):
        CBSE = "CBSE", "CBSE"
        SSC = "SSC", "SSC (State Board)"

    class Group(models.TextChoices):
        JUNIOR = "JUNIOR", "Classes 1-10"
        SENIOR = "SENIOR", "11th & 12th"

    name = models.CharField(max_length=255)
    udise_code = models.CharField(max_length=11, unique=True, validators=[udise_validator])
    board = models.CharField(max_length=50, choices=Board.choices, default=Board.CBSE)
    group = models.CharField(max_length=10, choices=Group.choices, default=Group.JUNIOR)
    state = models.CharField(max_length=50, default="Andhra Pradesh", editable=False)
    district = models.CharField(max_length=100)
    address = models.TextField()
    affiliation_number = models.CharField(max_length=50)
    principal_name = models.CharField(max_length=150)

    class Meta:
        verbose_name = "School Profile"
        constraints = [
            models.UniqueConstraint(fields=["board", "group"], name="core_schoolprofile_board_group_uniq"),
        ]

    def __str__(self):
        return self.name


class AcademicYear(UIDModel):
    name = models.CharField(max_length=20, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return self.name

