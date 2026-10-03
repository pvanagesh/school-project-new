"""Splits SchoolProfile into one row per division (board x junior/senior
group) instead of one row for the whole school — see the model docstring.
`board` becomes a real, editable choice field instead of a fixed/uneditable
one, `group` is new, and the two together must be unique (at most one
profile per division).
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="schoolprofile",
            name="board",
            field=models.CharField(
                choices=[("CBSE", "CBSE"), ("SSC", "SSC (State Board)")],
                default="CBSE",
                max_length=50,
            ),
        ),
        migrations.AddField(
            model_name="schoolprofile",
            name="group",
            field=models.CharField(
                choices=[("JUNIOR", "Classes 1-10"), ("SENIOR", "11th & 12th")],
                default="JUNIOR",
                max_length=10,
            ),
        ),
        migrations.AddConstraint(
            model_name="schoolprofile",
            constraint=models.UniqueConstraint(fields=("board", "group"), name="core_schoolprofile_board_group_uniq"),
        ),
    ]
