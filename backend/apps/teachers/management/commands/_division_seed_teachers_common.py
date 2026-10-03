"""Shared implementation behind `seed_cbse_teachers` and `seed_ssc_teachers`
— not a command itself (the leading underscore keeps Django's command
discovery from picking it up).

Seeds one example Teacher account per class level for the given board — 14
in total — each assigned_board=<board> and assigned_group matching their
level (JUNIOR for LKG-10, SENIOR for 11-12). Each is also set as the class
teacher of one section in their level: the "A" section for junior levels,
and the Science stream's "A" section for the two senior levels.

Role is TEACHER for all of them (not CLASS_TEACHER) — being someone's class
teacher is the Section.class_teacher link, not the account's role.

Teacher ids use the school's per-division college code, marked as staff
with an -EMP suffix:
    CBSE junior (LKG-10) -> CBSCSL-EMP001, ...   CBSE senior (11-12) -> CBSCB-EMP001, ...
    SSC junior  (LKG-10) -> SSCSL-EMP001,  ...   SSC senior (11-12)  -> IBCLG-EMP001, ...

Requires the matching seed_<board>_division to have been run first —
classes/sections for that board need to already exist. Skips (with a
warning) any level whose class or "A" section isn't found rather than
failing the whole run.

Idempotent — safe to re-run. Usernames and teacher_ids are fixed, so
re-running updates nothing for teachers that already exist and leaves their
passwords untouched.
"""

import secrets
import string
from datetime import date

from django.db import transaction

from apps.academics.models import Section, SchoolClass
from apps.accounts.models import Role, User
from apps.teachers.models import Teacher

LEVELS = [
    ("LKG", "LKG"), ("UKG", "UKG"), ("1", "Class 1"), ("2", "Class 2"), ("3", "Class 3"),
    ("4", "Class 4"), ("5", "Class 5"), ("6", "Class 6"), ("7", "Class 7"), ("8", "Class 8"),
    ("9", "Class 9"), ("10", "Class 10"), ("11", "Class 11"), ("12", "Class 12"),
]
SENIOR_LEVELS = {"11", "12"}

# Per-division teacher-id prefixes — see module docstring.
ID_PREFIXES = {
    "CBSE": ("CBSCSL-EMP", "CBSCB-EMP"),
    "SSC": ("SSCSL-EMP", "IBCLG-EMP"),
}

# Distinct username prefixes per board so seed_cbse_teachers and
# seed_ssc_teachers can never collide on the same login username.
USERNAME_PREFIXES = {
    "CBSE": "cbse.teacher",
    "SSC": "ssc.teacher",
}

FIRST_NAMES = [
    "Ramesh", "Padma", "Srinivas", "Anjali", "Vinod", "Bhavani", "Harish", "Sowmya",
    "Chandra", "Lalitha", "Ravi", "Nirmala", "Sudhakar", "Jyothi",
]
LAST_NAMES = [
    "Rao", "Naidu", "Chowdary", "Prasad", "Varma", "Reddy", "Sarma", "Devi",
    "Murthy", "Krishna", "Babu", "Sastry", "Rani", "Kumar",
]
SUBJECTS = [
    "English", "Mathematics", "General Science", "Social Studies", "Telugu",
    "Hindi", "Physics", "Chemistry", "Biology", "Computer Science", "Commerce",
    "Economics", "Accountancy", "Physical Education",
]

JOINING_DATE = date(2026, 6, 1)


def _generate_password(length=12):
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def seed_division_teachers(command, board):
    """command: the BaseCommand instance calling this (used for styled
    stdout output). board: 'CBSE' or 'SSC'."""
    role = Role.objects.filter(name="TEACHER").first()
    if not role:
        command.stderr.write(command.style.ERROR("No Role named TEACHER exists — cannot proceed."))
        return

    junior_prefix, senior_prefix = ID_PREFIXES[board]
    username_prefix = USERNAME_PREFIXES[board]

    created_count = 0
    passwords = []
    # Separate numbering per division, same as seed_<board>_division's
    # student ids.
    junior_n = 0
    senior_n = 0

    with transaction.atomic():
        for i, (level, class_name) in enumerate(LEVELS):
            cls = SchoolClass.objects.filter(level=level, board=board).first()
            if not cls:
                command.stdout.write(command.style.WARNING(
                    f"  no {board} class for level {level} yet — run seed_{board.lower()}_division first. Skipped."
                ))
                continue

            section = (
                Section.objects.filter(school_class=cls, name="A", stream="SCIENCE").first()
                if level in SENIOR_LEVELS
                else Section.objects.filter(school_class=cls, name="A", stream=None).first()
            )

            username = f"{username_prefix}{i + 1:02d}"
            first_name = FIRST_NAMES[i % len(FIRST_NAMES)]
            last_name = LAST_NAMES[i % len(LAST_NAMES)]
            subject = SUBJECTS[i % len(SUBJECTS)]
            is_senior = level in SENIOR_LEVELS
            group = "SENIOR" if is_senior else "JUNIOR"
            if is_senior:
                senior_n += 1
                teacher_id = f"{senior_prefix}{senior_n:03d}"
            else:
                junior_n += 1
                teacher_id = f"{junior_prefix}{junior_n:03d}"

            user, user_created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": f"{username}@vedhaschool.edu.in",
                    "is_active": True,
                    "role": role,
                    "phone": f"98765{40000 + i:05d}"[-10:],
                    "assigned_board": board,
                    "assigned_group": group,
                },
            )
            if user_created:
                password = _generate_password()
                user.set_password(password)
                user.save()
                passwords.append((username, password))
                created_count += 1
            else:
                # Already existed (re-run) — make sure the division tag is
                # still correct, but leave name/password untouched.
                user.role = role
                user.assigned_board = board
                user.assigned_group = group
                user.save(update_fields=["role", "assigned_board", "assigned_group"])

            teacher, teacher_created = Teacher.objects.get_or_create(
                user=user,
                defaults={
                    "teacher_id": teacher_id,
                    "first_name": first_name,
                    "last_name": last_name,
                    "qualification": "B.Ed, M.A.",
                    "experience_years": 2 + (i % 8),
                    "subject_specialization": subject,
                    "contact": user.phone,
                    "joining_date": JOINING_DATE,
                },
            )

            command.stdout.write(f"  {username:<18} {first_name} {last_name:<12} {subject:<18} -> {class_name} ({group})")

            if section and section.class_teacher_id is None:
                section.class_teacher = teacher
                section.save(update_fields=["class_teacher"])
                command.stdout.write(f"    set as class teacher of {class_name} - {section.name}"
                                      f"{f' ({section.stream})' if section.stream else ''}")
            elif section and section.class_teacher_id == teacher.id:
                command.stdout.write("    already class teacher of their section")
            elif section:
                command.stdout.write(command.style.WARNING("    that section already has a different class teacher — left as-is"))
            else:
                command.stdout.write(command.style.WARNING(f"    no matching 'A' section found for {class_name} — run seed_{board.lower()}_division first."))

    command.stdout.write(command.style.SUCCESS(f"Done. {created_count} new teacher account(s) created for {board}."))
    if passwords:
        command.stdout.write(command.style.WARNING("Generated passwords (share securely, ask them to change after first login):"))
        for username, password in passwords:
            command.stdout.write(f"  {username}: {password}")
