"""Applies the school's per-division student-id code scheme to EVERY
student, not just newly seeded ones — including the existing CBSE students
that still carry their original generic STU#### ids from before the board
split.

The 4 codes, one per division:
    CBSE junior  (LKG-10)  -> CBSCSL001, CBSCSL002, ...  ("CBSE School")
    CBSE senior  (11-12)   -> CBSCB001,  CBSCB002,  ...  ("CBSE Board" — senior/intermediate)
    SSC junior   (LKG-10)  -> SSCSL001,  SSCSL002,  ...  ("SSC School")
    SSC senior   (11-12)   -> IBCLG001,  IBCLG002,  ...  ("Intermediate Board College")

A student's division comes from their current_class's board and level, the
same way the rest of this app scopes by division. A student whose
student_id already has the right prefix for their division is left alone;
everyone else gets renumbered to the next free number under their
division's prefix. Numbering follows each student's database id, so it's
stable and repeatable.

student_id is a display/business identifier only — nothing in this project
looks students up by it (Attendance/Fees/Exams/Timetable all relate by the
numeric database id), so renumbering it doesn't touch attendance, fees,
marks, or timetable history for these students.

SAFE BY DEFAULT: with no flags, this only shows what WOULD change — a table
of every student whose id would be renamed, old -> new — and writes
nothing. Review that output, then re-run with --apply to actually save the
new ids.

Usage (from backend/, with the venv active):
    python manage.py apply_college_codes            # preview only, no changes
    python manage.py apply_college_codes --apply     # actually rename
"""

import re

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.students.models import Student

SENIOR_LEVELS = {"11", "12"}

PREFIXES = {
    ("CBSE", "JUNIOR"): "CBSCSL",
    ("CBSE", "SENIOR"): "CBSCB",
    ("SSC", "JUNIOR"): "SSCSL",
    ("SSC", "SENIOR"): "IBCLG",
}


def _division_of(student):
    cls = student.current_class
    group = "SENIOR" if cls.level in SENIOR_LEVELS else "JUNIOR"
    return cls.board, group


class Command(BaseCommand):
    help = "Renumbers every student's student_id to match their division's college code (CBSCSL/CBSCB/SSCSL/IBCLG)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply", action="store_true",
            help="Actually save the new ids. Without this flag, only a preview is printed and nothing is written.",
        )

    def handle(self, *args, **options):
        apply_changes = options["apply"]

        students = list(Student.objects.select_related("current_class").order_by("id"))

        # Group by division, tracking which numbers under each prefix are
        # already taken by a student whose id is already correctly coded —
        # those are left untouched, and their numbers are reserved so no one
        # else in the same division gets renumbered to a clashing id.
        by_division = {}
        already_used_numbers = {prefix: set() for prefix in PREFIXES.values()}
        to_rename = []

        for student in students:
            division = _division_of(student)
            prefix = PREFIXES[division]
            by_division.setdefault(prefix, []).append(student)

            match = re.fullmatch(rf"{prefix}(\d+)", student.student_id)
            if match:
                already_used_numbers[prefix].add(int(match.group(1)))
            else:
                to_rename.append((student, prefix))

        # Assign each student needing a new id the next free number in their
        # division, skipping any number already taken by an already-correct
        # id in that same division.
        next_number = {prefix: 1 for prefix in PREFIXES.values()}
        changes = []
        for student, prefix in to_rename:
            n = next_number[prefix]
            while n in already_used_numbers[prefix]:
                n += 1
            new_id = f"{prefix}{n:03d}"
            already_used_numbers[prefix].add(n)
            next_number[prefix] = n + 1
            changes.append((student, new_id))

        if not changes:
            self.stdout.write(self.style.SUCCESS("Nothing to do — every student's id already matches their division's college code."))
            return

        self.stdout.write(f"{len(changes)} of {len(students)} student(s) would be renumbered:")
        for student, new_id in changes:
            self.stdout.write(f"  {student.student_id:<12} -> {new_id:<12} {student.first_name} {student.last_name}")

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                "\nPreview only — nothing was changed. Re-run with --apply to save these ids."
            ))
            return

        with transaction.atomic():
            for student, new_id in changes:
                student.student_id = new_id
                student.save(update_fields=["student_id"])

        self.stdout.write(self.style.SUCCESS(f"\nDone. {len(changes)} student id(s) updated."))
