"""Seeds a starter set of Common Rooms (shared facilities, not tied to any
one section) — Library, Music Room, Science Lab, etc. — so the Common
Rooms tab isn't empty.

Each is created with class_group=BOTH (shows up in both the Classes 1-10
and Intermediate panels) — edit any of them afterwards on the Common Rooms
tab if one should really be Classes-1-10-only or Intermediate-only.

Idempotent — get_or_create by name, so re-running never duplicates or
overwrites one you've already renamed/edited; it only adds ones that don't
exist yet under these exact names.

Usage (from backend/, with the venv active):
    python manage.py add_common_rooms
"""

from django.core.management.base import BaseCommand

from apps.academics.models import CommonRoom

ROOMS = [
    ("Library", "COMM-001"),
    ("Music Room", "COMM-002"),
    ("Science Lab", "COMM-003"),
    ("Computer Lab", "COMM-004"),
    ("Yoga Hall", "COMM-005"),
    ("Sports Room", "COMM-006"),
    ("Auditorium", "COMM-007"),
    ("Playground", "COMM-008"),
    ("Dance Room", "COMM-009"),
    ("Robotics Lab", "COMM-010"),
]


class Command(BaseCommand):
    help = "Seeds a starter set of Common Rooms (Library, Music Room, Science Lab, ...)."

    def handle(self, *args, **options):
        created_count = 0
        for name, code in ROOMS:
            room, created = CommonRoom.objects.get_or_create(
                name=name,
                defaults={
                    "code": code,
                    "room_type": CommonRoom.RoomType.COMMON_ROOM,
                    "class_group": CommonRoom.ClassGroup.BOTH,
                },
            )
            if created:
                created_count += 1
                self.stdout.write(f"  created {name} ({code})")
            else:
                self.stdout.write(self.style.WARNING(f"  {name} already exists — left as-is"))

        self.stdout.write(self.style.SUCCESS(f"Done. {created_count} new common room(s) created."))
