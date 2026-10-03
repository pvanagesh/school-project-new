"""One-off diagnostic (read-only, changes nothing). Prints exactly what the
Mark Attendance tab needs for EMP003 (Suresh Rao) so we can see why his
section isn't showing up in the picker.

Usage (from backend/, with the venv active):
    python manage.py diagnose_emp003
"""

from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.academics.models import Section, Timetable
from apps.teachers.models import Teacher


class Command(BaseCommand):
    help = "Read-only diagnostic for EMP003's Mark Attendance eligibility."

    def handle(self, *args, **options):
        self.stdout.write("--- User ---")
        user = User.objects.filter(username="teacher003").first()
        if not user:
            self.stdout.write(self.style.ERROR("  No User with username 'teacher003' exists at all."))
            return
        self.stdout.write(f"  id={user.id} username={user.username} role={getattr(user.role, 'name', None)} is_active={user.is_active}")

        self.stdout.write("--- Teacher profile ---")
        teacher = Teacher.objects.filter(teacher_id="EMP003").first()
        if not teacher:
            self.stdout.write(self.style.ERROR("  No Teacher with teacher_id 'EMP003' exists."))
            return
        self.stdout.write(f"  Teacher pk={teacher.id} name={teacher.first_name} {teacher.last_name} linked_user_id={teacher.user_id}")

        if teacher.user_id != user.id:
            self.stdout.write(self.style.ERROR(
                f"  MISMATCH: User.id={user.id} but Teacher.user_id={teacher.user_id} — "
                "this is why the portal can't find his data (User.teacher_profile won't resolve to this Teacher row)."
            ))
        else:
            self.stdout.write("  User <-> Teacher link OK.")

        self.stdout.write("--- Class Teacher of ---")
        ct_sections = Section.objects.filter(class_teacher=teacher)
        if ct_sections.exists():
            for s in ct_sections:
                self.stdout.write(f"  Section id={s.id} name={s.name}")
        else:
            self.stdout.write("  (none)")

        self.stdout.write("--- Section id=2 (should be his Class Teacher section per the restore) ---")
        section2 = Section.objects.filter(id=2).first()
        if not section2:
            self.stdout.write(self.style.ERROR("  Section id=2 no longer exists."))
        else:
            self.stdout.write(f"  Section id=2 name={section2.name} class_teacher_id={section2.class_teacher_id} (his Teacher pk is {teacher.id})")

        self.stdout.write("--- Timetable rows for this teacher ---")
        rows = Timetable.objects.filter(teacher=teacher).order_by("day_of_week", "period")
        if not rows.exists():
            self.stdout.write(self.style.ERROR("  No Timetable rows at all for this teacher — his restore may not have run, or was skipped."))
        else:
            for r in rows:
                self.stdout.write(f"  {r.day_of_week} P{r.period} section_id={r.section_id} subject_id={r.subject_id}")

        self.stdout.write("--- Period 1 rows specifically (these are what let a non-Class-Teacher mark attendance) ---")
        p1 = rows.filter(period=1)
        if not p1.exists():
            self.stdout.write(self.style.WARNING("  No Period 1 rows found for this teacher."))
        else:
            for r in p1:
                sec_exists = Section.objects.filter(id=r.section_id).exists()
                flag = "" if sec_exists else "  <-- SECTION NO LONGER EXISTS"
                self.stdout.write(f"  {r.day_of_week} section_id={r.section_id}{flag}")

        self.stdout.write(self.style.SUCCESS("Done."))
