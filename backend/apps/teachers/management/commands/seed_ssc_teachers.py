"""Seeds one example Teacher per SSC class level (usernames ssc.teacher01-14,
teacher_ids SSCSL-EMP.../IBCLG-EMP...) and sets each as class teacher of one
section in their level — see _division_seed_teachers_common.py for the full
details.

Requires seed_ssc_division to have been run first.

Idempotent — safe to re-run.

Usage (from backend/, with the venv active):
    python manage.py seed_ssc_teachers
"""

from django.core.management.base import BaseCommand

from ._division_seed_teachers_common import seed_division_teachers


class Command(BaseCommand):
    help = "Seeds one example Teacher per SSC class level and assigns them as class teacher of one section each."

    def handle(self, *args, **options):
        seed_division_teachers(self, "SSC")
