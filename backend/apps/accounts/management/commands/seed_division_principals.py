"""Seeds one example Principal account for each of the school's 4 divisions
(CBSE junior, CBSE senior, SSC junior, SSC senior), so every division has
its own Principal to log in and test with — not just the pre-existing
`principal` account and the one-off `ramesh.kunal` created earlier.

Creates 4 accounts:
    principal.cbse.junior  -> CBSE   / Classes 1-10
    principal.cbse.senior  -> CBSE   / 11th & 12th
    principal.ssc.junior   -> SSC    / Classes 1-10
    principal.ssc.senior   -> SSC    / 11th & 12th

Role is PRINCIPAL for all 4. Doesn't touch the existing `principal` or
`ramesh.kunal` accounts, or anyone else — these are 4 new, separate logins.

Idempotent — safe to re-run. If a username already exists, its role and
division are re-confirmed but its name and password are left untouched; a
generated password is only printed for accounts newly created this run.

Usage (from backend/, with the venv active):
    python manage.py seed_division_principals
"""

import secrets
import string

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role, User

PRINCIPALS = [
    {
        "username": "principal.cbse.junior",
        "first_name": "Lakshmi",
        "last_name": "Rao",
        "board": User.AssignedBoard.CBSE,
        "group": User.AssignedGroup.JUNIOR,
    },
    {
        "username": "principal.cbse.senior",
        "first_name": "Prakash",
        "last_name": "Iyer",
        "board": User.AssignedBoard.CBSE,
        "group": User.AssignedGroup.SENIOR,
    },
    {
        "username": "principal.ssc.junior",
        "first_name": "Kamala",
        "last_name": "Naidu",
        "board": User.AssignedBoard.SSC,
        "group": User.AssignedGroup.JUNIOR,
    },
    {
        "username": "principal.ssc.senior",
        "first_name": "Srinivasa",
        "last_name": "Chowdary",
        "board": User.AssignedBoard.SSC,
        "group": User.AssignedGroup.SENIOR,
    },
]


def _generate_password(length=12):
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class Command(BaseCommand):
    help = "Seeds one example Principal account for each of the 4 board x junior/senior divisions."

    def handle(self, *args, **options):
        role = Role.objects.filter(name="PRINCIPAL").first()
        if not role:
            self.stderr.write(self.style.ERROR("No Role named PRINCIPAL exists — cannot proceed."))
            return

        passwords = []
        created_count = 0

        with transaction.atomic():
            for p in PRINCIPALS:
                user, created = User.objects.get_or_create(
                    username=p["username"],
                    defaults={
                        "first_name": p["first_name"],
                        "last_name": p["last_name"],
                        "email": f"{p['username']}@vedhaschool.edu.in",
                        "is_active": True,
                        "role": role,
                        "assigned_board": p["board"],
                        "assigned_group": p["group"],
                    },
                )
                if created:
                    password = _generate_password()
                    user.set_password(password)
                    user.save()
                    passwords.append((user.username, password))
                    created_count += 1
                    self.stdout.write(f"  created {user.username:<24} {p['board']} / {p['group']}")
                else:
                    user.role = role
                    user.assigned_board = p["board"]
                    user.assigned_group = p["group"]
                    user.save(update_fields=["role", "assigned_board", "assigned_group"])
                    self.stdout.write(f"  already existed {user.username:<16} — division confirmed as {p['board']} / {p['group']}, password left unchanged")

        self.stdout.write(self.style.SUCCESS(f"Done. {created_count} new Principal account(s) created."))
        if passwords:
            self.stdout.write(self.style.WARNING("Generated passwords (share securely, ask them to change after first login):"))
            for username, password in passwords:
                self.stdout.write(f"  {username}: {password}")
