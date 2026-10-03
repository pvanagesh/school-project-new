"""One-off recovery command.

teacher004 (EMP004, Anitha Reddy) and teacher005 (EMP005, Prasad Naidu) were
accidentally deleted from the Teachers page on 2026-08-23 (their Delete icon
sits right next to Edit with no spacing, and deleting a Teacher cascades to
delete every Timetable slot they had). This restores both from the known-good
data captured in backend/mysql_dump.json that day: their Teacher profile,
their Class Teacher assignment, and all 47 Timetable slots between them.

Safe to re-run — every step is get_or_create, or only fills in a field that
is currently empty, so it never overwrites anything that already exists.

Usage (from backend/, with the venv active):
    python manage.py restore_emp004_emp005
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role, User
from apps.academics.models import Section, Timetable
from apps.teachers.models import Teacher

TEACHERS = [
    {
        "teacher_id": "EMP004",
        "username": "teacher004",
        "email": "teacher004@vedhaschool.edu.in",
        "first_name": "Anitha",
        "last_name": "Reddy",
        "qualification": "Not provided",
        "experience_years": 0,
        "subject_specialization": "Science",
        "contact": "Not provided",
        "joining_date": "2026-06-01",
        "password_hash": "pbkdf2_sha256$1200000$Qpwyfn1YfFsjnKAZwcqa5x$as8McLYsb5DaFiYXV0zJQe+ed7/GE26o5XeWVZyvYj0=",
        "class_teacher_of_section_id": 3,
    },
    {
        "teacher_id": "EMP005",
        "username": "teacher005",
        "email": "teacher005@vedhaschool.edu.in",
        "first_name": "Prasad",
        "last_name": "Naidu",
        "qualification": "Not provided",
        "experience_years": 0,
        "subject_specialization": "Social Science",
        "contact": "Not provided",
        "joining_date": "2026-06-01",
        "password_hash": "pbkdf2_sha256$1200000$m8MBgdMQ9MbfWRLi5cLnnn$zTK9GyftSLS4IBzGHpF+VeBdmrpM4wDfHeR+RD+bjC8=",
        "class_teacher_of_section_id": 4,
    },
]

TIMETABLE_ROWS = {
    "EMP004": [
        {'section': 20, 'subject': 14, 'day_of_week': 'FRI', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 40, 'day_of_week': 'FRI', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 25, 'day_of_week': 'FRI', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 22, 'day_of_week': 'FRI', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 16, 'subject': 14, 'day_of_week': 'MON', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 22, 'subject': 14, 'day_of_week': 'MON', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 40, 'day_of_week': 'MON', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 25, 'day_of_week': 'MON', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 21, 'subject': 14, 'day_of_week': 'SAT', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 23, 'day_of_week': 'SAT', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 9, 'day_of_week': 'SAT', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 19, 'subject': 14, 'day_of_week': 'THU', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 25, 'subject': 14, 'day_of_week': 'THU', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 22, 'day_of_week': 'THU', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 23, 'day_of_week': 'THU', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 17, 'subject': 14, 'day_of_week': 'TUE', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 23, 'subject': 14, 'day_of_week': 'TUE', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 22, 'day_of_week': 'TUE', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 23, 'day_of_week': 'TUE', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 18, 'subject': 14, 'day_of_week': 'WED', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 24, 'subject': 14, 'day_of_week': 'WED', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 40, 'day_of_week': 'WED', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 25, 'day_of_week': 'WED', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
    ],
    "EMP005": [
        {'section': 21, 'subject': 15, 'day_of_week': 'FRI', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-019'},
        {'section': 4, 'subject': 40, 'day_of_week': 'FRI', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 25, 'day_of_week': 'FRI', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 22, 'day_of_week': 'FRI', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 17, 'subject': 15, 'day_of_week': 'MON', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-015'},
        {'section': 23, 'subject': 15, 'day_of_week': 'MON', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-021'},
        {'section': 4, 'subject': 40, 'day_of_week': 'MON', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 25, 'day_of_week': 'MON', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 20, 'subject': 15, 'day_of_week': 'SAT', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-018'},
        {'section': 4, 'subject': 23, 'day_of_week': 'SAT', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 9, 'day_of_week': 'SAT', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 53, 'day_of_week': 'SAT', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 18, 'subject': 15, 'day_of_week': 'THU', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-016'},
        {'section': 24, 'subject': 15, 'day_of_week': 'THU', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-022'},
        {'section': 4, 'subject': 22, 'day_of_week': 'THU', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 23, 'day_of_week': 'THU', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 16, 'subject': 15, 'day_of_week': 'TUE', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-014'},
        {'section': 22, 'subject': 15, 'day_of_week': 'TUE', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-020'},
        {'section': 4, 'subject': 22, 'day_of_week': 'TUE', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 23, 'day_of_week': 'TUE', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 19, 'subject': 15, 'day_of_week': 'WED', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-017'},
        {'section': 25, 'subject': 15, 'day_of_week': 'WED', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-023'},
        {'section': 4, 'subject': 40, 'day_of_week': 'WED', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 25, 'day_of_week': 'WED', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
    ],
}


class Command(BaseCommand):
    help = "Restores teacher004 (EMP004) and teacher005 (EMP005) plus their timetable, from mysql_dump.json."

    def handle(self, *args, **options):
        with transaction.atomic():
            for t in TEACHERS:
                self._restore_one(t)
        self.stdout.write(self.style.SUCCESS("Done."))

    def _restore_one(self, t):
        self.stdout.write(f"--- {t['teacher_id']} ({t['first_name']} {t['last_name']}) ---")

        user, user_created = User.objects.get_or_create(
            username=t["username"],
            defaults={
                "password": t["password_hash"],
                "first_name": t["first_name"],
                "last_name": t["last_name"],
                "email": t["email"],
                "is_active": True,
                "role": Role.objects.get(name="TEACHER"),
                "phone": "Not provided",
            },
        )
        if user_created:
            self.stdout.write(f"  user {t['username']}: created, original password restored")
        else:
            self.stdout.write(f"  user {t['username']}: already existed, left as-is")

        teacher, teacher_created = Teacher.objects.get_or_create(
            teacher_id=t["teacher_id"],
            defaults={
                "user": user,
                "first_name": t["first_name"],
                "last_name": t["last_name"],
                "qualification": t["qualification"],
                "experience_years": t["experience_years"],
                "subject_specialization": t["subject_specialization"],
                "contact": t["contact"],
                "joining_date": t["joining_date"],
            },
        )
        self.stdout.write(f"  teacher profile: {'created' if teacher_created else 'already existed, left as-is'}")

        restored, skipped = 0, 0
        for row in TIMETABLE_ROWS[t["teacher_id"]]:
            section_id = row["section"]
            if not Section.objects.filter(id=section_id).exists():
                self.stdout.write(self.style.WARNING(
                    f"  section id {section_id} no longer exists — skipped {row['day_of_week']} P{row['period']}"
                ))
                skipped += 1
                continue
            _, created = Timetable.objects.get_or_create(
                section_id=section_id,
                day_of_week=row["day_of_week"],
                period=row["period"],
                defaults={
                    "subject_id": row["subject"],
                    "teacher": teacher,
                    "start_time": row["start_time"],
                    "end_time": row["end_time"],
                    "classroom": row["classroom"],
                },
            )
            if created:
                restored += 1
            else:
                skipped += 1
                self.stdout.write(self.style.WARNING(
                    f"  section {section_id} {row['day_of_week']} P{row['period']} is already occupied — left as-is"
                ))
        self.stdout.write(f"  timetable: {restored} slot(s) restored, {skipped} skipped")

        section = Section.objects.filter(id=t["class_teacher_of_section_id"]).first()
        if not section:
            self.stdout.write(self.style.WARNING(
                f"  section id {t['class_teacher_of_section_id']} no longer exists — can't restore Class Teacher"
            ))
        elif section.class_teacher_id is None:
            section.class_teacher = teacher
            section.save(update_fields=["class_teacher"])
            self.stdout.write(f"  set as Class Teacher of section id {section.id}")
        elif section.class_teacher_id == teacher.id:
            self.stdout.write("  already Class Teacher of their section")
        else:
            self.stdout.write(self.style.WARNING(
                f"  section id {section.id} already has a different Class Teacher — left as-is"
            ))
