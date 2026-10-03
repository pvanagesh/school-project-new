"""Adds a handful of *unassigned* SSC · 11th & 12th (Intermediate) teachers —
extra Class Teacher candidates for the MPC/BiPC/CEC/HEC sections.

seed_ssc_teachers only creates one teacher per class level, and the two
senior ones (levels 11 and 12) are already spent as class teacher of the
legacy plain-"Science" "A" section, so the Intermediate MPC/BiPC/CEC/HEC
sections have no free candidate to pick from. This adds more, left
unassigned to any section, so you can assign them from the Sections tab's
Edit dialog yourself.

Safe to run more than once — each run adds `--count` more on top rather
than reusing earlier usernames/teacher_ids (it looks up whatever already
exists and continues numbering after it).

Usage (from backend/, with the venv active):
    python manage.py add_intermediate_teachers
    python manage.py add_intermediate_teachers --count 4
"""

import secrets
import string
from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role, User
from apps.teachers.models import Teacher

FIRST_NAMES = ["Divya", "Naveen", "Pallavi", "Suresh", "Aruna", "Kiran", "Meena", "Gopal"]
LAST_NAMES = ["Kumari", "Reddy", "Rao", "Sharma", "Prakash", "Iyer", "Naik", "Verma"]
SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "Civics", "Economics", "Commerce", "History"]

# Distinct from seed_ssc_teachers' own ssc.teacherNN / IBCLG-EMPNNN so the
# two commands can never collide with each other.
USERNAME_PREFIX = "ssc.senior.teacher"
TEACHER_ID_PREFIX = "IBCLGX-EMP"
JOINING_DATE = date(2026, 6, 1)


def _generate_password(length=12):
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _next_number(values, prefix):
    nums = [int(v[len(prefix):]) for v in values if v[len(prefix):].isdigit()]
    return (max(nums) + 1) if nums else 1


class Command(BaseCommand):
    help = "Adds unassigned SSC · 11th & 12th teachers as extra class-teacher candidates."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=6, help="How many teachers to add (default 6).")

    def handle(self, *args, **options):
        count = options["count"]

        role = Role.objects.filter(name="TEACHER").first()
        if not role:
            self.stderr.write(self.style.ERROR("No Role named TEACHER exists — cannot proceed."))
            return

        next_teacher_num = _next_number(
            list(Teacher.objects.filter(teacher_id__startswith=TEACHER_ID_PREFIX).values_list("teacher_id", flat=True)),
            TEACHER_ID_PREFIX,
        )
        next_username_num = _next_number(
            list(User.objects.filter(username__startswith=USERNAME_PREFIX).values_list("username", flat=True)),
            USERNAME_PREFIX,
        )

        created = []
        with transaction.atomic():
            for i in range(count):
                username = f"{USERNAME_PREFIX}{next_username_num + i:02d}"
                first_name = FIRST_NAMES[i % len(FIRST_NAMES)]
                last_name = LAST_NAMES[i % len(LAST_NAMES)]
                subject = SUBJECTS[i % len(SUBJECTS)]
                teacher_id = f"{TEACHER_ID_PREFIX}{next_teacher_num + i:03d}"
                phone = f"97654{(next_teacher_num + i):05d}"[-10:]

                password = _generate_password()
                user = User(
                    username=username,
                    first_name=first_name,
                    last_name=last_name,
                    email=f"{username}@vedhaschool.edu.in",
                    is_active=True,
                    role=role,
                    phone=phone,
                    assigned_board="SSC",
                    assigned_group="SENIOR",
                )
                user.set_password(password)
                user.save()

                Teacher.objects.create(
                    user=user,
                    teacher_id=teacher_id,
                    first_name=first_name,
                    last_name=last_name,
                    qualification="B.Ed, M.A.",
                    experience_years=3 + (i % 6),
                    subject_specialization=subject,
                    contact=phone,
                    joining_date=JOINING_DATE,
                )
                created.append((username, password, first_name, last_name, subject))

        self.stdout.write(self.style.SUCCESS(
            f"Created {len(created)} new SSC · 11th & 12th teacher(s), not assigned to any section yet:"
        ))
        for username, password, first_name, last_name, subject in created:
            self.stdout.write(f"  {username:<22} {first_name} {last_name:<12} {subject:<12} password: {password}")
        self.stdout.write(self.style.WARNING(
            "Share these passwords securely and ask each teacher to change theirs after first login."
        ))
