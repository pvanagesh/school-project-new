"""Re-seeds the baseline reference data that normally comes from Django data
migrations (accounts.0002_seed_roles + 0004_role_is_system,
academics.0004_seed_curriculum, academics.0010_seed_common_rooms) — the 7
system roles, the subject catalog, the CBSE curriculum (which subjects each
class/stream/combination requires), and the common-room list.

Why this exists: on a database whose SCHEMA is already fully up to date
(every table/column from every migration physically exists) but whose ROWS
were wiped — e.g. after `migrate --fake` was used to get an already-current
Postgres database's migration bookkeeping back in sync — plain `migrate`
won't re-run those data migrations (they're marked as applied even though
their inserts never happened on this database). This command does the same
inserts directly against the live models instead, without touching schema.

Only seeds curriculum for the CBSE board, matching what the original
migration did back when every class belonged to a single, whole-school
board (before the CBSE/SSC split) — SSC's own curriculum, if the school
wants one, is a separate, not-yet-built piece of work.

Idempotent — every insert is get_or_create, so this is safe to re-run, and
safe to run whether or not seed_cbse_division/seed_ssc_division have been
run yet (curriculum just creates bare CBSE SchoolClass rows if they don't
already exist; a later seed_cbse_division run fills in their sections and
students against those same rows).

Usage (from backend/, with the venv active):
    python manage.py seed_baseline_reference_data
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role
from apps.academics.models import ClassStreamProfile, CommonRoom, ProfileSubject, SchoolClass, Subject

SYSTEM_ROLE_NAMES = [
    "SUPER_ADMIN", "PRINCIPAL", "TEACHER", "CLASS_TEACHER", "STUDENT", "PARENT", "ACCOUNTANT",
]

# name -> (language_tier, co_scholastic_category)
SUBJECTS = {
    "English": ("FIRST", None),
    "Telugu": ("SECOND", None),
    "Hindi": ("THIRD", None),
    "Telugu/Hindi": (None, None),
    "Sanskrit": ("ADDITIONAL", None),
    "Urdu": ("ADDITIONAL", None),
    "French": ("ADDITIONAL", None),
    "German": ("ADDITIONAL", None),
    "Mathematics": (None, None),
    "Mathematics (Standard/Basic)": (None, None),
    "Applied Mathematics": (None, None),
    "Environmental Awareness": (None, None),
    "EVS": (None, None),
    "Science": (None, None),
    "Social Science": (None, None),
    "Physics": (None, None),
    "Chemistry": (None, None),
    "Biology": (None, None),
    "Accountancy": (None, None),
    "Business Studies": (None, None),
    "Economics": (None, None),
    "Rhymes": (None, None),
    "Storytelling": (None, None),
    "General Awareness": (None, None),
    "General Knowledge": (None, None),
    "Computer Science": (None, "TECHNOLOGY"),
    "Computer Applications": (None, "TECHNOLOGY"),
    "Information Technology": (None, "TECHNOLOGY"),
    "Artificial Intelligence": (None, "TECHNOLOGY"),
    "Robotics": (None, "TECHNOLOGY"),
    "Coding": (None, "TECHNOLOGY"),
    "Informatics Practices": (None, "TECHNOLOGY"),
    "Entrepreneurship": (None, None),
    "Psychology": (None, None),
    "Biotechnology": (None, None),
    "Physical Education": (None, "SPORTS"),
    "Health & Physical Education": (None, "SPORTS"),
    "Yoga": (None, "SPORTS"),
    "Athletics": (None, "SPORTS"),
    "Art & Craft": (None, "ARTS"),
    "Art Education": (None, "ARTS"),
    "Drawing": (None, "ARTS"),
    "Painting": (None, "ARTS"),
    "Craft": (None, "ARTS"),
    "Music": (None, "PERFORMING_ARTS"),
    "Dance": (None, "PERFORMING_ARTS"),
    "Drama": (None, "PERFORMING_ARTS"),
    "Work Education": (None, "LIFE_SKILLS"),
    "SUPW": (None, "LIFE_SKILLS"),
    "Value Education": (None, "LIFE_SKILLS"),
    "Moral Education": (None, "LIFE_SKILLS"),
    "Health Education": (None, "LIFE_SKILLS"),
}

LEVEL_LABELS = {
    "LKG": "LKG", "UKG": "UKG",
    **{str(n): f"Class {n}" for n in range(1, 13)},
}

_PRIMARY_LANG = ["English", "Mathematics", "EVS", "Telugu", "Hindi"]
_PRIMARY_CO = ["Art Education", "Music", "Dance", "Physical Education", "Yoga", "Moral Education"]
_PRIMARY_CO_345 = ["Art Education", "Music", "Physical Education", "Yoga", "Value Education"]
_MIDDLE_MANDATORY = ["English", "Mathematics", "Science", "Social Science", "Telugu", "Hindi"]
_MIDDLE_OPTIONAL = ["Computer Science", "Artificial Intelligence", "Robotics", "Coding"]
_MIDDLE_CO = ["Art Education", "Work Education", "Health & Physical Education", "Yoga", "Music"]
_SECONDARY_MANDATORY = ["English", "Mathematics (Standard/Basic)", "Science", "Social Science", "Telugu/Hindi"]
_SECONDARY_OPTIONAL = ["Artificial Intelligence", "Information Technology", "Computer Applications"]
_SECONDARY_CO = ["Art Education", "Work Education", "Health & Physical Education"]

_COMMERCE_ELECTIVES = [
    ("COMMERCE_MATHS", "Mathematics"),
    ("COMMERCE_APPLIED_MATHS", "Applied Mathematics"),
    ("COMMERCE_CS", "Computer Science"),
    ("COMMERCE_IP", "Informatics Practices"),
    ("COMMERCE_ENTREPRENEURSHIP", "Entrepreneurship"),
]


def _senior_science_profiles(level):
    return [
        {
            "level": level, "stream": "SCIENCE", "combination": "PCM",
            "mandatory": ["English", "Physics", "Chemistry", "Mathematics"],
            "optional": ["Computer Science", "Informatics Practices", "Physical Education", "Entrepreneurship"],
            "co_scholastic": ["Health & Physical Education"],
        },
        {
            "level": level, "stream": "SCIENCE", "combination": "PCB",
            "mandatory": ["English", "Physics", "Chemistry", "Biology"],
            "optional": ["Psychology", "Biotechnology", "Physical Education", "Informatics Practices"],
            "co_scholastic": ["Health & Physical Education"],
        },
        {
            "level": level, "stream": "SCIENCE", "combination": "PCMB",
            "mandatory": ["English", "Physics", "Chemistry", "Mathematics", "Biology"],
            "optional": ["Computer Science", "Physical Education"],
            "co_scholastic": ["Health & Physical Education"],
        },
    ]


def _senior_commerce_profiles(level):
    return [
        {
            "level": level, "stream": "COMMERCE", "combination": combo,
            "mandatory": ["English", "Accountancy", "Business Studies", "Economics", elective],
            "optional": [],
            "co_scholastic": ["Physical Education"],
        }
        for combo, elective in _COMMERCE_ELECTIVES
    ]


PROFILES = [
    {"level": "LKG", "stream": None, "combination": None,
     "mandatory": ["English", "Mathematics", "Environmental Awareness", "Rhymes", "Storytelling"],
     "optional": ["General Awareness"], "co_scholastic": ["Art & Craft", "Music", "Physical Education"]},
    {"level": "UKG", "stream": None, "combination": None,
     "mandatory": ["English", "Mathematics", "Environmental Awareness", "Rhymes", "Storytelling"],
     "optional": ["General Awareness"], "co_scholastic": ["Art & Craft", "Music", "Physical Education"]},

    {"level": "1", "stream": None, "combination": None, "mandatory": _PRIMARY_LANG,
     "optional": ["Computer Science", "General Knowledge"], "co_scholastic": _PRIMARY_CO},
    {"level": "2", "stream": None, "combination": None, "mandatory": _PRIMARY_LANG,
     "optional": ["Computer Science", "General Knowledge"], "co_scholastic": _PRIMARY_CO},

    {"level": "3", "stream": None, "combination": None, "mandatory": _PRIMARY_LANG,
     "optional": ["Computer Science", "General Knowledge"], "co_scholastic": _PRIMARY_CO_345},
    {"level": "4", "stream": None, "combination": None, "mandatory": _PRIMARY_LANG,
     "optional": ["Computer Science", "General Knowledge"], "co_scholastic": _PRIMARY_CO_345},
    {"level": "5", "stream": None, "combination": None, "mandatory": _PRIMARY_LANG,
     "optional": ["Computer Science", "General Knowledge"], "co_scholastic": _PRIMARY_CO_345},

    {"level": "6", "stream": None, "combination": None, "mandatory": _MIDDLE_MANDATORY,
     "optional": _MIDDLE_OPTIONAL, "co_scholastic": _MIDDLE_CO},
    {"level": "7", "stream": None, "combination": None, "mandatory": _MIDDLE_MANDATORY,
     "optional": _MIDDLE_OPTIONAL, "co_scholastic": _MIDDLE_CO},
    {"level": "8", "stream": None, "combination": None, "mandatory": _MIDDLE_MANDATORY,
     "optional": _MIDDLE_OPTIONAL, "co_scholastic": _MIDDLE_CO},

    {"level": "9", "stream": None, "combination": None, "mandatory": _SECONDARY_MANDATORY,
     "optional": _SECONDARY_OPTIONAL, "co_scholastic": _SECONDARY_CO},
    {"level": "10", "stream": None, "combination": None, "mandatory": _SECONDARY_MANDATORY,
     "optional": _SECONDARY_OPTIONAL, "co_scholastic": _SECONDARY_CO},

    *_senior_science_profiles("11"),
    *_senior_commerce_profiles("11"),
    *_senior_science_profiles("12"),
    *_senior_commerce_profiles("12"),
]

COMMON_ROOMS = ["Art Room", "Playground", "Music Room", "Yoga Hall", "Computer Lab", "Room 1", "Room 101"]


class Command(BaseCommand):
    help = "Re-seeds roles, the subject catalog, CBSE curriculum, and common rooms — for a DB whose schema is current but whose data migrations never actually inserted their rows."

    def handle(self, *args, **options):
        with transaction.atomic():
            self._seed_roles()
            self._seed_subjects()
            self._seed_curriculum()
            self._seed_common_rooms()
        self.stdout.write(self.style.SUCCESS("Done."))

    def _seed_roles(self):
        created = 0
        for name in SYSTEM_ROLE_NAMES:
            role, was_created = Role.objects.get_or_create(name=name, defaults={"is_system": True})
            if not was_created and not role.is_system:
                role.is_system = True
                role.save(update_fields=["is_system"])
            created += was_created
        self.stdout.write(f"Roles: {created} created, {len(SYSTEM_ROLE_NAMES)} total confirmed.")

    def _seed_subjects(self):
        created = 0
        for name, (lang_tier, co_cat) in SUBJECTS.items():
            _, was_created = Subject.objects.get_or_create(
                name=name, defaults={"language_tier": lang_tier, "co_scholastic_category": co_cat},
            )
            created += was_created
        self.stdout.write(f"Subjects: {created} created, {len(SUBJECTS)} total confirmed.")

    def _seed_curriculum(self):
        subject_objs = {name: Subject.objects.get(name=name) for name in SUBJECTS}
        profiles_created = links_created = classes_created = 0

        for spec in PROFILES:
            school_class, cls_created = SchoolClass.objects.get_or_create(
                level=spec["level"], board="CBSE", defaults={"name": LEVEL_LABELS[spec["level"]]},
            )
            classes_created += cls_created
            profile, profile_created = ClassStreamProfile.objects.get_or_create(
                school_class=school_class, stream=spec["stream"], combination=spec["combination"], board="CBSE",
            )
            profiles_created += profile_created
            for category, names in (
                ("MANDATORY", spec["mandatory"]),
                ("OPTIONAL", spec["optional"]),
                ("CO_SCHOLASTIC", spec["co_scholastic"]),
            ):
                for name in names:
                    _, link_created = ProfileSubject.objects.get_or_create(
                        profile=profile, subject=subject_objs[name], category=category,
                    )
                    links_created += link_created

        self.stdout.write(
            f"Curriculum (CBSE): {classes_created} class(es), {profiles_created} profile(s), "
            f"{links_created} subject link(s) newly created."
        )

    def _seed_common_rooms(self):
        created = 0
        for name in COMMON_ROOMS:
            _, was_created = CommonRoom.objects.get_or_create(name=name)
            created += was_created
        self.stdout.write(f"Common rooms: {created} created, {len(COMMON_ROOMS)} total confirmed.")
