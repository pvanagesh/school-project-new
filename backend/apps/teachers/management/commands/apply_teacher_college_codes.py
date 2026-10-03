"""Applies the school's per-division college code to EVERY teacher's
teacher_id, including the existing CBSE teachers that still carry their
original flat EMP001-EMP014 ids from before the board split — the same
renumbering apply_college_codes does for students.

A teacher's division comes from their linked account's assigned_board /
assigned_group (Users & Roles) — the same fields that already control what
they can see everywhere else in the app — not from which classes they
happen to teach. A teacher with no division assigned yet (assigned_board or
assigned_group still null) is skipped with a warning; assign them one on
Users & Roles first, then re-run this.

The 4 codes, marked as staff with an -EMP suffix and numbered separately
per division:
    CBSE junior  -> CBSCSL-EMP001, CBSCSL-EMP002, ...
    CBSE senior  -> CBSCB-EMP001,  CBSCB-EMP002,  ...
    SSC junior   -> SSCSL-EMP001,  SSCSL-EMP002,  ...
    SSC senior   -> IBCLG-EMP001,  IBCLG-EMP002,  ...

A teacher whose teacher_id already has the right prefix for their division
is left alone; everyone else gets renumbered to the next free number under
their division's prefix, in database-id order.

teacher_id is a display/business identifier only — nothing in this project
looks teachers up by it (Timetable/Section.class_teacher all relate by the
numeric database id), so renumbering it doesn't touch their timetable or
class-teacher assignments.

SAFE BY DEFAULT: with no flags, this only shows what WOULD change and
writes nothing. Review the preview, then re-run with --apply to save it.

Usage (from backend/, with the venv active):
    python manage.py apply_teacher_college_codes            # preview only
    python manage.py apply_teacher_college_codes --apply     # actually rename
"""

import re

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.teachers.models import Teacher

PREFIXES = {
    ("CBSE", "JUNIOR"): "CBSCSL-EMP",
    ("CBSE", "SENIOR"): "CBSCB-EMP",
    ("SSC", "JUNIOR"): "SSCSL-EMP",
    ("SSC", "SENIOR"): "IBCLG-EMP",
}


class Command(BaseCommand):
    help = "Renumbers every teacher's teacher_id to match their assigned division's college code."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply", action="store_true",
            help="Actually save the new ids. Without this flag, only a preview is printed and nothing is written.",
        )

    def handle(self, *args, **options):
        apply_changes = options["apply"]

        teachers = list(Teacher.objects.select_related("user").order_by("id"))

        skipped = []
        by_division_used = {prefix: set() for prefix in PREFIXES.values()}
        to_rename = []

        for teacher in teachers:
            board = teacher.user.assigned_board
            group = teacher.user.assigned_group
            if not board or not group:
                skipped.append(teacher)
                continue
            prefix = PREFIXES.get((board, group))
            if not prefix:
                skipped.append(teacher)
                continue

            match = re.fullmatch(rf"{re.escape(prefix)}(\d+)", teacher.teacher_id)
            if match:
                by_division_used[prefix].add(int(match.group(1)))
            else:
                to_rename.append((teacher, prefix))

        next_number = {prefix: 1 for prefix in PREFIXES.values()}
        changes = []
        for teacher, prefix in to_rename:
            n = next_number[prefix]
            while n in by_division_used[prefix]:
                n += 1
            new_id = f"{prefix}{n:03d}"
            by_division_used[prefix].add(n)
            next_number[prefix] = n + 1
            changes.append((teacher, new_id))

        if skipped:
            self.stdout.write(self.style.WARNING(
                f"{len(skipped)} teacher(s) skipped — no division assigned yet "
                f"(set assigned_board/assigned_group on Users & Roles first):"
            ))
            for teacher in skipped:
                self.stdout.write(f"  {teacher.teacher_id:<12} {teacher.first_name} {teacher.last_name} ({teacher.user.username})")

        if not changes:
            self.stdout.write(self.style.SUCCESS(
                "\nNothing to rename — every division-assigned teacher's id already matches their college code."
            ))
            return

        self.stdout.write(f"\n{len(changes)} of {len(teachers)} teacher(s) would be renumbered:")
        for teacher, new_id in changes:
            self.stdout.write(f"  {teacher.teacher_id:<14} -> {new_id:<16} {teacher.first_name} {teacher.last_name}")

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                "\nPreview only — nothing was changed. Re-run with --apply to save these ids."
            ))
            return

        with transaction.atomic():
            for teacher, new_id in changes:
                teacher.teacher_id = new_id
                teacher.save(update_fields=["teacher_id"])

        self.stdout.write(self.style.SUCCESS(f"\nDone. {len(changes)} teacher id(s) updated."))
