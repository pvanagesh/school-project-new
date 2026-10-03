"""Seeds example classes/sections/students for the SSC board — see
_division_seed_common.py for the full details of what's created and the
student-id scheme (SSCSL001... for junior, IBCLG001... for senior).

Idempotent — safe to re-run.

Usage (from backend/, with the venv active):
    python manage.py seed_ssc_division
"""

from django.core.management.base import BaseCommand

from ._division_seed_common import seed_division


class Command(BaseCommand):
    help = "Seeds example SSC-board classes, sections, and students so the SSC division has data to test."

    def handle(self, *args, **options):
        seed_division(self, "SSC")
