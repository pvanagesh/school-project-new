from django.db import migrations


def seed_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    names = ["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "CLASS_TEACHER", "STUDENT", "PARENT", "ACCOUNTANT"]
    for name in names:
        Role.objects.get_or_create(name=name)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_roles, noop),
    ]
