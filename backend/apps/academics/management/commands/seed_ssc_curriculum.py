"""Seeds SSC's OWN curriculum — real Andhra Pradesh State Board (English medium)
subjects per class — instead of copying CBSE's. This is the fix for "no state
board subjects are added"/"give valid data": earlier, SSC's Subject Catalog
was empty because nothing had ever populated ClassStreamProfile/ProfileSubject
for the SSC board (mirror_cbse_curriculum_to_ssc.py copies CBSE's curriculum
verbatim; this command instead builds SSC's own, state-board-appropriate list).

Curriculum shape (English medium, Andhra Pradesh SSC):
  LKG/UKG      - English, Telugu, Maths, EVS-style foundation subjects.
  Class 1-2    - English (1st language), Telugu (2nd language), Maths, EVS.
  Class 3-5    - adds Hindi (3rd language) and Computer Science (optional).
  Class 6-8    - English/Telugu/Hindi, Maths, Science, Social Science.
  Class 9-10   - Science splits into Physics/Chemistry/Biology (as AP SSC
                 papers do from Class 9), plus Social Science.
  Class 11-12  - Intermediate (state board) — NOT "Class 11"/"Class 12" like
                 CBSE, and not CBSE's Science/Commerce + PCM/PCB/PCMB model
                 either. SSC's Intermediate is organised into the standard
                 Andhra Pradesh group codes instead: MPC, BiPC (Science) and
                 CEC, HEC (Commerce/Humanities) — each one a fixed named
                 combination, not an elective choice. Telugu stays a
                 compulsory second language paper in every group, which is
                 what actually distinguishes state-board Intermediate from
                 CBSE's 11-12 (CBSE drops the second language there). The
                 classes themselves are named "Intermediate 1st/2nd Year".

Mostly reuses the existing (board-agnostic) Subject catalog by name — a name
like "English" or "Physics" is the same catalog entry CBSE's curriculum
already uses — but also creates three subjects CBSE's curriculum never
needed (Civics, History, Commerce) for the CEC/HEC groups.

Requires the Combination choices added alongside this command (MPC/BIPC/CEC/
HEC on ClassStreamProfile/Section — see migration 0014_alter_combination_choices
and Combination.for_stream in apps/academics/models.py).

Idempotent (get_or_create throughout) — safe to re-run. Only ever adds; never
removes a ProfileSubject you've since edited by hand on the SSC side.

Usage (from backend/, with the venv active):
    python manage.py seed_ssc_curriculum
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.academics.models import ClassStreamProfile, ProfileSubject, SchoolClass, Subject

LEVEL_LABELS = {
    "LKG": "LKG", "UKG": "UKG",
    **{str(n): f"Class {n}" for n in range(1, 11)},
    # SSC's 11/12 aren't "Class 11"/"Class 12" — they're Intermediate years.
    "11": "Intermediate 1st Year",
    "12": "Intermediate 2nd Year",
}

# Subjects that only the Intermediate CEC/HEC groups need and CBSE's
# curriculum never created — this command adds them to the shared catalog.
_NEW_SUBJECTS = {
    "Civics": (None, None),
    "History": (None, None),
    "Commerce": (None, None),
}


def _intermediate_profiles(level):
    return [
        {
            "level": level, "stream": "SCIENCE", "combination": "MPC",
            "mandatory": ["English", "Telugu", "Mathematics", "Physics", "Chemistry"],
            "optional": ["Computer Science"],
            "co_scholastic": ["Physical Education"],
        },
        {
            "level": level, "stream": "SCIENCE", "combination": "BIPC",
            "mandatory": ["English", "Telugu", "Physics", "Chemistry", "Biology"],
            "optional": ["Psychology"],
            "co_scholastic": ["Physical Education"],
        },
        {
            "level": level, "stream": "COMMERCE", "combination": "CEC",
            "mandatory": ["English", "Telugu", "Civics", "Economics", "Commerce"],
            "optional": [],
            "co_scholastic": ["Physical Education"],
        },
        {
            "level": level, "stream": "HUMANITIES", "combination": "HEC",
            "mandatory": ["English", "Telugu", "History", "Economics", "Civics"],
            "optional": [],
            "co_scholastic": ["Physical Education"],
        },
    ]


PROFILES = [
    {"level": "LKG", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Mathematics", "Environmental Awareness", "Rhymes", "Storytelling"],
     "optional": ["General Knowledge"], "co_scholastic": ["Art & Craft", "Music", "Physical Education"]},
    {"level": "UKG", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Mathematics", "Environmental Awareness", "Rhymes", "Storytelling"],
     "optional": ["General Knowledge"], "co_scholastic": ["Art & Craft", "Music", "Physical Education"]},

    {"level": "1", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Mathematics", "EVS"],
     "optional": ["General Knowledge"], "co_scholastic": ["Art & Craft", "Music", "Physical Education", "Value Education"]},
    {"level": "2", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Mathematics", "EVS"],
     "optional": ["General Knowledge"], "co_scholastic": ["Art & Craft", "Music", "Physical Education", "Value Education"]},

    {"level": "3", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Hindi", "Mathematics", "EVS"],
     "optional": ["Computer Science", "General Knowledge"],
     "co_scholastic": ["Art & Craft", "Music", "Physical Education", "Value Education"]},
    {"level": "4", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Hindi", "Mathematics", "EVS"],
     "optional": ["Computer Science", "General Knowledge"],
     "co_scholastic": ["Art & Craft", "Music", "Physical Education", "Value Education"]},
    {"level": "5", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Hindi", "Mathematics", "EVS"],
     "optional": ["Computer Science", "General Knowledge"],
     "co_scholastic": ["Art & Craft", "Music", "Physical Education", "Value Education"]},

    {"level": "6", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Hindi", "Mathematics", "Science", "Social Science"],
     "optional": ["Computer Science"],
     "co_scholastic": ["Art Education", "Work Education", "Health & Physical Education", "Value Education"]},
    {"level": "7", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Hindi", "Mathematics", "Science", "Social Science"],
     "optional": ["Computer Science"],
     "co_scholastic": ["Art Education", "Work Education", "Health & Physical Education", "Value Education"]},
    {"level": "8", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Hindi", "Mathematics", "Science", "Social Science"],
     "optional": ["Computer Science", "Information Technology"],
     "co_scholastic": ["Art Education", "Work Education", "Health & Physical Education"]},

    {"level": "9", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Hindi", "Mathematics", "Physics", "Chemistry", "Biology", "Social Science"],
     "optional": ["Computer Science", "Information Technology"],
     "co_scholastic": ["Art Education", "Work Education", "Health & Physical Education"]},
    {"level": "10", "stream": None, "combination": None,
     "mandatory": ["English", "Telugu", "Hindi", "Mathematics", "Physics", "Chemistry", "Biology", "Social Science"],
     "optional": ["Computer Science", "Information Technology"],
     "co_scholastic": ["Art Education", "Work Education", "Health & Physical Education"]},

    *_intermediate_profiles("11"),
    *_intermediate_profiles("12"),
]


class Command(BaseCommand):
    help = "Seeds SSC's own Andhra Pradesh State Board (English medium) curriculum — classes, streams, and subjects."

    def handle(self, *args, **options):
        needed_names = set()
        for spec in PROFILES:
            needed_names.update(spec["mandatory"])
            needed_names.update(spec["optional"])
            needed_names.update(spec["co_scholastic"])

        subjects = {s.name: s for s in Subject.objects.filter(name__in=needed_names)}
        missing = needed_names - subjects.keys() - _NEW_SUBJECTS.keys()
        if missing:
            raise CommandError(
                "These subjects don't exist in the catalog yet, so nothing was changed: "
                f"{', '.join(sorted(missing))}. They should already exist from CBSE's curriculum — "
                "run migrations, or add them on the Subject Catalog page, then re-run this command."
            )

        catalog_subjects_created = 0
        classes_created = classes_already_there = 0
        profiles_created = profiles_already_there = 0
        subjects_created = subjects_already_there = 0

        with transaction.atomic():
            for name, (lang_tier, co_cat) in _NEW_SUBJECTS.items():
                subject, subject_was_created = Subject.objects.get_or_create(
                    name=name, defaults={"language_tier": lang_tier, "co_scholastic_category": co_cat},
                )
                subjects[name] = subject
                if subject_was_created:
                    catalog_subjects_created += 1

            for spec in PROFILES:
                school_class, class_was_created = SchoolClass.objects.get_or_create(
                    level=spec["level"], board="SSC", defaults={"name": LEVEL_LABELS[spec["level"]]},
                )
                if class_was_created:
                    classes_created += 1
                else:
                    classes_already_there += 1

                profile, profile_was_created = ClassStreamProfile.objects.get_or_create(
                    school_class=school_class, stream=spec["stream"], combination=spec["combination"],
                    board="SSC",
                )
                if profile_was_created:
                    profiles_created += 1
                else:
                    profiles_already_there += 1

                for category, names in (
                    ("MANDATORY", spec["mandatory"]),
                    ("OPTIONAL", spec["optional"]),
                    ("CO_SCHOLASTIC", spec["co_scholastic"]),
                ):
                    for name in names:
                        _, subject_link_created = ProfileSubject.objects.get_or_create(
                            profile=profile, subject=subjects[name], category=category,
                        )
                        if subject_link_created:
                            subjects_created += 1
                        else:
                            subjects_already_there += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done. {catalog_subjects_created} new catalog subject(s) added (Civics/History/Commerce), "
            f"{classes_created} new SSC class(es) created ({classes_already_there} already existed), "
            f"{profiles_created} new curriculum profile(s) created ({profiles_already_there} already existed), "
            f"{subjects_created} new subject link(s) added ({subjects_already_there} were already there)."
        ))
