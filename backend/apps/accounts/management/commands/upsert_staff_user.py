"""Creates a new staff account, or updates an existing one, from the command
line — the same fields the Users & Roles "Add User" dialog collects (name,
role, and for a division-scoped role, the CBSE/SSC board + junior/senior
group), so a new Principal/Teacher/Class Teacher/Accountant can be added
without opening the app.

If --username doesn't exist yet, a new account is created (a random
password is generated and printed unless --password is given). If it
already exists, the account is updated in place — role, division, and any
of first/last name, email, phone you pass — and the password is left alone
unless you explicitly pass --password to reset it. Either way this is safe
to re-run.

Examples (from backend/, with the venv active):
    # Create a second Principal, scoped to CBSE's senior-secondary (11-12) division
    python manage.py upsert_staff_user --username ramesh.principal --first-name Ramesh --last-name Kumar \\
        --role PRINCIPAL --board CBSE --group SENIOR

    # Same, but set the password explicitly instead of getting a generated one
    python manage.py upsert_staff_user --username ramesh.principal --first-name Ramesh --last-name Kumar \\
        --role PRINCIPAL --board CBSE --group SENIOR --password "SomeStrongPass123"

    # Super Admin / Student / Parent accounts aren't division-scoped, so omit --board/--group
    python manage.py upsert_staff_user --username jane.parent --first-name Jane --last-name Doe --role PARENT
"""

import secrets
import string

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import Role, User
from apps.accounts.scoping import DIVISION_SCOPED_ROLES


def _generate_password(length=12):
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class Command(BaseCommand):
    help = "Creates or updates one staff user account, including their role and (if applicable) division."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True, help="Login username. Looked up to decide create vs update.")
        parser.add_argument("--first-name", default=None)
        parser.add_argument("--last-name", default=None)
        parser.add_argument("--email", default=None)
        parser.add_argument("--phone", default=None)
        parser.add_argument("--role", required=True, help="Role name, e.g. PRINCIPAL, TEACHER, CLASS_TEACHER, ACCOUNTANT, STUDENT, PARENT, SUPER_ADMIN.")
        parser.add_argument("--board", default=None, choices=[c[0] for c in User.AssignedBoard.choices], help="Required for a division-scoped role (PRINCIPAL/TEACHER/CLASS_TEACHER/ACCOUNTANT).")
        parser.add_argument("--group", default=None, choices=[c[0] for c in User.AssignedGroup.choices], help="Required for a division-scoped role (PRINCIPAL/TEACHER/CLASS_TEACHER/ACCOUNTANT).")
        parser.add_argument("--password", default=None, help="Set/reset the login password. If omitted for a brand-new user, a random one is generated and printed.")

    def handle(self, *args, **options):
        username = options["username"]

        try:
            role = Role.objects.get(name=options["role"])
        except Role.DoesNotExist:
            available = ", ".join(Role.objects.order_by("name").values_list("name", flat=True))
            raise CommandError(f"No role named '{options['role']}'. Available roles: {available}")

        needs_division = role.name in DIVISION_SCOPED_ROLES
        board = options["board"]
        group = options["group"]
        if needs_division and (not board or not group):
            raise CommandError(
                f"Role {role.name} is division-scoped — pass both --board and --group "
                f"(one of {[c[0] for c in User.AssignedBoard.choices]} / {[c[0] for c in User.AssignedGroup.choices]})."
            )
        if not needs_division and (board or group):
            self.stdout.write(self.style.WARNING(
                f"Role {role.name} isn't division-scoped — --board/--group were given but will be ignored (left null)."
            ))
            board = None
            group = None

        with transaction.atomic():
            user, created = User.objects.get_or_create(username=username, defaults={"is_active": True})

            if options["first_name"] is not None:
                user.first_name = options["first_name"]
            if options["last_name"] is not None:
                user.last_name = options["last_name"]
            if options["email"] is not None:
                user.email = options["email"]
            if options["phone"] is not None:
                user.phone = options["phone"]
            user.role = role
            user.assigned_board = board
            user.assigned_group = group

            generated_password = None
            if options["password"]:
                user.set_password(options["password"])
            elif created:
                generated_password = _generate_password()
                user.set_password(generated_password)

            user.save()

        action = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{action} user '{user.username}' ({user.first_name} {user.last_name})."))
        self.stdout.write(f"  role: {role.name}")
        if needs_division:
            self.stdout.write(f"  division: {board} / {group}")
        if generated_password:
            self.stdout.write(self.style.WARNING(f"  generated password: {generated_password}  (share this securely and ask them to change it after first login)"))
        elif options["password"]:
            self.stdout.write("  password: set from --password")
        elif not created:
            self.stdout.write("  password: left unchanged")
