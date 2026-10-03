"""Seeds one example Teacher per CBSE class level (usernames cbse.teacher01-14,
teacher_ids CBSCSL-EMP.../CBSCB-EMP...) and sets each as class teacher of one
section in their level — see _division_seed_teachers_common.py for the full
details.

Requires seed_cbse_division to have been run first.

Idempotent — safe to re-run.

Usage (from backend/, with the venv active):
    python manage.py seed_cbse_teachers
"""

from django.core.management.base import BaseCommand

from ._division_seed_teachers_common import seed_division_teachers


class Command(BaseCommand):
    help = "Seeds one example Teacher per CBSE class level and assigns them as class teacher of one section each."

    def handle(self, *args, **options):
        seed_division_teachers(self, "CBSE")
