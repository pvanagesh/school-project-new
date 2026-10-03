from django.db import migrations

# Shared facilities already in use as free-text `Timetable.classroom` values
# that aren't a section's own room (e.g. "Class 3 - A") — seeded so the new
# classroom picker's options line up with existing data.
COMMON_ROOMS = ["Art Room", "Playground", "Music Room", "Yoga Hall", "Computer Lab", "Room 1", "Room 101"]


def seed_common_rooms(apps, schema_editor):
    CommonRoom = apps.get_model("academics", "CommonRoom")
    for name in COMMON_ROOMS:
        CommonRoom.objects.get_or_create(name=name)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0009_commonroom"),
    ]

    operations = [
        migrations.RunPython(seed_common_rooms, noop),
    ]
