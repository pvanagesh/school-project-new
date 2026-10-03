"""Seeds example classes/sections/students for the CBSE board — see
_division_seed_common.py for the full details of what's created and the
student-id scheme (CBSCSL001... for junior, CBSCB001... for senior).

On the original database, CBSE's classes/sections/students already existed
from before the board split, so this command wasn't needed. On a fresh
database (e.g. after moving to Postgres) neither board has any data yet —
run this alongside seed_ssc_division to populate both.

Idempotent — safe to re-run.

Usage (from backend/, with the venv active):
    python manage.py seed_cbse_division
"""

from django.core.management.base import BaseCommand

from ._division_seed_common import seed_division


class Command(BaseCommand):
    help = "Seeds example CBSE-board classes, sections, and students so the CBSE division has data to test."

    def handle(self, *args, **options):
        seed_division(self, "CBSE")
