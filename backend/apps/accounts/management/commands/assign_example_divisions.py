"""Gives every existing staff account (Principal, Teacher, Class Teacher,
Accountant) an example division to assign — so the CBSE/SSC x junior/senior
split has real data behind it right away, instead of every one of those
accounts seeing nothing until Super Admin visits Users & Roles one at a time.

Super Admin is left untouched by design — it isn't division-scoped and
always sees all 4 divisions. Student and Parent accounts are also left
untouched: they aren't division-scoped either (a student's own current_class
already determines what they see), so assigned_board/assigned_group is
meaningless for those roles.

Accounts are spread round-robin, in a stable order (by id), across the 4
divisions:
    CBSE + Classes 1-10   ->  CBSE + 11th & 12th
    SSC  + Classes 1-10   ->  SSC  + 11th & 12th
    (repeats)

These are placeholder/example assignments meant to unblock testing, not a
recommendation of who should really be in which division — Super Admin
should revisit Users & Roles afterwards and set each person's real division.
Accounts that already have a division are left as-is unless --force is
passed.

Usage (from backend/, with the venv active):
    python manage.py assign_example_divisions
    python manage.py assign_example_divisions --force   # reassign everyone, overwriting existing divisions
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from apps.accounts.models import User
from apps.accounts.scoping import DIVISION_SCOPED_ROLES

DIVISIONS = [
    (User.AssignedBoard.CBSE, User.AssignedGroup.JUNIOR),
    (User.AssignedBoard.CBSE, User.AssignedGroup.SENIOR),
    (User.AssignedBoard.SSC, User.AssignedGroup.JUNIOR),
    (User.AssignedBoard.SSC, User.AssignedGroup.SENIOR),
]


class Command(BaseCommand):
    help = (
        "Assigns each existing Principal/Teacher/Class Teacher/Accountant account "
        "an example division (round-robin across CBSE/SSC x junior/senior), so the "
        "4-division split has data to show right away. Super Admin, Student and "
        "Parent accounts are left untouched."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Reassign accounts that already have a division, not just unassigned ones.",
        )

    def handle(self, *args, **options):
        force = options["force"]

        users = User.objects.filter(role__name__in=DIVISION_SCOPED_ROLES)
        if not force:
            users = users.filter(Q(assigned_board__isnull=True) | Q(assigned_group__isnull=True))
        users = users.select_related("role").order_by("id")

        if not users.exists():
            self.stdout.write(self.style.WARNING(
                "No accounts to assign — every staff account already has a division. "
                "Pass --force to reassign everyone."
            ))
            return

        with transaction.atomic():
            for i, user in enumerate(users):
                board, group = DIVISIONS[i % len(DIVISIONS)]
                user.assigned_board = board
                user.assigned_group = group
                user.save(update_fields=["assigned_board", "assigned_group"])
                self.stdout.write(
                    f"  {user.username:<20} {user.role.name:<14} -> {board} / {group}"
                )

        self.stdout.write(self.style.SUCCESS(f"Done. {users.count()} account(s) assigned."))
        self.stdout.write(
            "These are example assignments — go to Users & Roles to set each person's real division."
        )
