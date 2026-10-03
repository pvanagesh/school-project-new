"""One-off recovery command.

teacher003 (EMP003, Suresh Rao) was deleted on 2026-08-23 while an admin was
editing their account and changing their password on the Users & Roles page
(deleting a User there cascades to delete the linked Teacher profile, and in
turn every Timetable slot they had — none of that was visible in that page's
delete confirmation). This restores them from the known-good data captured
in backend/mysql_dump.json that day: their User login, their Teacher profile,
their Class Teacher assignment, and all 27 Timetable slots.

Safe to re-run — every step is get_or_create, or only fills in a field that
is currently empty, so it never overwrites anything that already exists.

Usage (from backend/, with the venv active):
    python manage.py restore_emp003
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role, User
from apps.academics.models import Section, Timetable
from apps.teachers.models import Teacher

TEACHER = {
    "teacher_id": "EMP003",
    "username": "teacher003",
    "email": "teacher003@vedhaschool.edu.in",
    "first_name": "Suresh",
    "last_name": "Rao",
    "qualification": "Not provided",
    "experience_years": 0,
    "subject_specialization": "Environmental Studies",
    "contact": "Not provided",
    "joining_date": "2026-06-01",
    "password_hash": "pbkdf2_sha256$1200000$AfDeCFOlx7Sp4D0GkXgUyC$QM7j5mO15Kh+zyNqXcyoWpEnro4/kAlswuO4nuJxl4g=",
    "class_teacher_of_section_id": 2,
}

TIMETABLE_ROWS = [
    {'section': 5, 'subject': 13, 'day_of_week': 'MON', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-006'},
    {'section': 6, 'subject': 13, 'day_of_week': 'TUE', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-007'},
    {'section': 8, 'subject': 13, 'day_of_week': 'WED', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-008'},
    {'section': 9, 'subject': 13, 'day_of_week': 'THU', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-009'},
    {'section': 10, 'subject': 13, 'day_of_week': 'FRI', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-001'},
    {'section': 11, 'subject': 13, 'day_of_week': 'SAT', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-032'},
    {'section': 12, 'subject': 13, 'day_of_week': 'MON', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-010'},
    {'section': 13, 'subject': 13, 'day_of_week': 'TUE', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-011'},
    {'section': 14, 'subject': 13, 'day_of_week': 'WED', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-012'},
    {'section': 15, 'subject': 13, 'day_of_week': 'THU', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-013'},
    {'section': 4, 'subject': 13, 'day_of_week': 'MON', 'period': 4, 'start_time': '09:00:00', 'end_time': '10:00:00', 'classroom': 'Class-005'},
    {'section': 1, 'subject': 13, 'day_of_week': 'MON', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
    {'section': 1, 'subject': 13, 'day_of_week': 'TUE', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
    {'section': 1, 'subject': 13, 'day_of_week': 'THU', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
    {'section': 2, 'subject': 13, 'day_of_week': 'TUE', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
    {'section': 2, 'subject': 25, 'day_of_week': 'WED', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
    {'section': 2, 'subject': 22, 'day_of_week': 'WED', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
    {'section': 2, 'subject': 23, 'day_of_week': 'THU', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
    {'section': 2, 'subject': 13, 'day_of_week': 'FRI', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
    {'section': 2, 'subject': 25, 'day_of_week': 'FRI', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
    {'section': 2, 'subject': 22, 'day_of_week': 'FRI', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
    {'section': 2, 'subject': 23, 'day_of_week': 'SAT', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
    {'section': 2, 'subject': 13, 'day_of_week': 'SAT', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
    {'section': 2, 'subject': 25, 'day_of_week': 'SAT', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
    {'section': 3, 'subject': 13, 'day_of_week': 'TUE', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
    {'section': 4, 'subject': 13, 'day_of_week': 'WED', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
    {'section': 4, 'subject': 13, 'day_of_week': 'SAT', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
]


class Command(BaseCommand):
    help = "Restores teacher003 (EMP003) plus their timetable, from mysql_dump.json."

    def handle(self, *args, **options):
        with transaction.atomic():
            self._restore()
        self.stdout.write(self.style.SUCCESS("Done."))

    def _restore(self):
        t = TEACHER
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
        for row in TIMETABLE_ROWS:
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
