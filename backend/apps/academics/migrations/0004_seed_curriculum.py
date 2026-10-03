from django.db import migrations

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


def seed_curriculum(apps, schema_editor):
    SchoolClass = apps.get_model("academics", "SchoolClass")
    Subject = apps.get_model("academics", "Subject")
    ClassStreamProfile = apps.get_model("academics", "ClassStreamProfile")
    ProfileSubject = apps.get_model("academics", "ProfileSubject")

    subject_objs = {}
    for name, (lang_tier, co_cat) in SUBJECTS.items():
        obj, _ = Subject.objects.get_or_create(
            name=name, defaults={"language_tier": lang_tier, "co_scholastic_category": co_cat},
        )
        subject_objs[name] = obj

    for spec in PROFILES:
        school_class, _ = SchoolClass.objects.get_or_create(
            level=spec["level"], defaults={"name": LEVEL_LABELS[spec["level"]]},
        )
        profile, _ = ClassStreamProfile.objects.get_or_create(
            school_class=school_class, stream=spec["stream"], combination=spec["combination"],
        )
        for category, names in (
            ("MANDATORY", spec["mandatory"]),
            ("OPTIONAL", spec["optional"]),
            ("CO_SCHOLASTIC", spec["co_scholastic"]),
        ):
            for name in names:
                ProfileSubject.objects.get_or_create(
                    profile=profile, subject=subject_objs[name], category=category,
                )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0003_alter_subject_options_alter_section_unique_together_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_curriculum, noop),
    ]
