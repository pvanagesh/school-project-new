"""Gives every Intermediate/11th & 12th section a class room, reusing any
already-existing unassigned Class-NN room first and creating new ones
(named Class-01, Class-02, ..., continuing after the highest existing
number) only for whatever's still short.

An unassigned class room is invisible in the UI (the "Unassigned" list was
removed from the Class Rooms tab), so this no longer creates spare
unassigned rooms by default — pass --extra to also create some on top, but
note they won't show up anywhere until a future section needs one and gets
assigned to it here.

Safe to re-run — only touches sections that still have no room, and only
creates as many new rooms as are actually needed (plus --extra).

Usage (from backend/, with the venv active):
    python manage.py add_class_rooms
    python manage.py add_class_rooms --extra 5
"""

import re

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.academics.models import CommonRoom, Section

NAME_RE = re.compile(r"^Class-(\d+)$")
SENIOR_LEVELS = ("11", "12")


class Command(BaseCommand):
    help = "Assigns a class room to every Intermediate/11th & 12th section that doesn't have one yet."

    def add_arguments(self, parser):
        parser.add_argument(
            "--extra", type=int, default=0,
            help="Extra unassigned class rooms to also create on top of what's needed (default 0).",
        )

    def handle(self, *args, **options):
        extra = options["extra"]

        needy_sections = list(
            Section.objects.filter(school_class__level__in=SENIOR_LEVELS, room__isnull=True)
            .select_related("school_class")
            .order_by("school_class__board", "school_class__level", "name")
        )

        assigned_room_ids = set(
            Section.objects.exclude(room__isnull=True).values_list("room_id", flat=True)
        )
        spare_rooms = list(
            CommonRoom.objects.filter(room_type=CommonRoom.RoomType.CLASS_ROOM)
            .exclude(id__in=assigned_room_ids)
            .order_by("name")
        )

        existing_nums = []
        for name in CommonRoom.objects.values_list("name", flat=True):
            m = NAME_RE.match(name)
            if m:
                existing_nums.append(int(m.group(1)))
        next_n = (max(existing_nums) + 1) if existing_nums else 1

        reused_count = 0
        created_count = 0
        with transaction.atomic():
            for i, section in enumerate(needy_sections):
                if i < len(spare_rooms):
                    room = spare_rooms[i]
                    reused_count += 1
                else:
                    name = f"Class-{next_n:02d}"
                    code = f"Class-{next_n:03d}"
                    room = CommonRoom.objects.create(name=name, code=code, room_type=CommonRoom.RoomType.CLASS_ROOM)
                    next_n += 1
                    created_count += 1

                section.room = room
                section.save(update_fields=["room"])
                self.stdout.write(
                    f"  {section.school_class.name} ({section.school_class.board}) - {section.name} -> {room.name}"
                )

            for _ in range(extra):
                name = f"Class-{next_n:02d}"
                code = f"Class-{next_n:03d}"
                CommonRoom.objects.create(name=name, code=code, room_type=CommonRoom.RoomType.CLASS_ROOM)
                next_n += 1
                self.stdout.write(self.style.WARNING(f"  created spare {name} ({code}) -> left unassigned"))

        self.stdout.write(self.style.SUCCESS(
            f"Done. {len(needy_sections)} senior section(s) now have a class room "
            f"({reused_count} reused from existing unassigned rooms, {created_count} newly created)."
        ))
