"""Shared implementation behind `seed_cbse_division` and `seed_ssc_division` —
not a command itself (the leading underscore keeps Django's command
discovery from picking it up; see django.core.management.find_commands).

Originally this logic lived only in seed_ssc_division.py, written for a
database where CBSE's classes/sections/students already existed (from the
project's original single-board setup) and only SSC needed seeding. Now that
a brand-new database starts with neither board populated, the same logic is
needed for CBSE too — so it's factored out here and both per-board commands
call seed_division(command, board) with their own id prefixes.

Creates, for whichever board is passed in:
  - All 14 classes (LKG, UKG, Class 1-12).
  - 2 sections ("A"/"B") in each junior class (LKG-10).
  - 4 sections (Science-A, Science-B, Commerce-A, Commerce-B) in each of
    Class 11 and Class 12.
  - 4 example students per section (32 sections total, ~128 students).

Student IDs follow the school's per-division college code scheme:
    CBSE junior  (LKG-10)  -> CBSCSL001, CBSCSL002, ...
    CBSE senior  (11-12)   -> CBSCB001,  CBSCB002,  ...
    SSC junior   (LKG-10)  -> SSCSL001,  SSCSL002,  ...
    SSC senior   (11-12)   -> IBCLG001,  IBCLG002,  ...

Student names, addresses, and contact numbers are synthetic placeholders,
not real people. Rooms and class teachers are left unassigned — assign
those yourself once the sections exist, or run the matching
seed_<board>_teachers command to fill in class teachers.

Idempotent — safe to re-run. Classes/sections are matched by (level/name,
board), and students by their generated student_id, so a re-run neither
duplicates anything nor overwrites rows you've since edited by hand.
"""

from datetime import date

from django.db import transaction

from apps.academics.models import Section, SchoolClass
from apps.students.models import Student

# Same order as SchoolClass.Level so classes are created/listed consistently.
JUNIOR_LEVELS = [
    ("LKG", "LKG"), ("UKG", "UKG"), ("1", "Class 1"), ("2", "Class 2"), ("3", "Class 3"),
    ("4", "Class 4"), ("5", "Class 5"), ("6", "Class 6"), ("7", "Class 7"),
    ("8", "Class 8"), ("9", "Class 9"), ("10", "Class 10"),
]
SENIOR_LEVELS = [("11", "Class 11"), ("12", "Class 12")]
SENIOR_STREAMS = ["SCIENCE", "COMMERCE"]

# Roughly how old a student in each level is on 1 June of the admission year
# — just enough to keep generated dates of birth plausible, not exact.
AGE_BY_LEVEL = {
    "LKG": 4, "UKG": 5, "1": 6, "2": 7, "3": 8, "4": 9, "5": 10,
    "6": 11, "7": 12, "8": 13, "9": 14, "10": 15, "11": 16, "12": 17,
}

STUDENTS_PER_SECTION = 4
ADMISSION_DATE = date(2026, 6, 1)

# Per-division student-id prefixes — see module docstring.
ID_PREFIXES = {
    "CBSE": ("CBSCSL", "CBSCB"),
    "SSC": ("SSCSL", "IBCLG"),
}

FIRST_NAMES_M = ["Arjun", "Abhiram", "Sai", "Rahul", "Kiran", "Vikram", "Manoj", "Ganesh", "Naveen", "Ajay"]
FIRST_NAMES_F = ["Kavya", "Gayatri", "Divya", "Priya", "Swathi", "Anitha", "Meera", "Lakshmi", "Sneha", "Deepika"]
LAST_NAMES = ["Rao", "Sharma", "Naidu", "Reddy", "Prasad", "Varma", "Menon", "Krishnan", "Iyer", "Chowdary"]
PARENT_FIRST_NAMES_M = ["Venkat", "Aarav", "Sanjay", "Nikhil", "Suresh", "Ramesh", "Mahesh", "Anil", "Ravi", "Prakash"]
AREAS = ["MG Road", "Madhapur", "Kondapur", "Gachibowli", "Ameerpet", "Jubilee Hills", "Kukatpally", "Begumpet"]


def seed_division(command, board):
    """command: the BaseCommand instance calling this (used for styled
    stdout output). board: 'CBSE' or 'SSC'."""
    junior_prefix, senior_prefix = ID_PREFIXES[board]

    # Separate id sequences per division — e.g. CBSCSL001, CBSCSL002... for
    # junior, CBSCB001, CBSCB002... for senior — rather than one shared
    # counter, so each starts at 001 under its own prefix.
    junior_counter = 0
    senior_counter = 0

    with transaction.atomic():
        classes_created = sections_created = students_created = 0

        for level, name in JUNIOR_LEVELS:
            cls, created = SchoolClass.objects.get_or_create(level=level, board=board, defaults={"name": name})
            classes_created += created
            for section_name in ["A", "B"]:
                section, section_created = Section.objects.get_or_create(
                    school_class=cls, name=section_name, stream=None, combination=None,
                )
                sections_created += section_created
                junior_counter, new_students = _seed_students(
                    section, level, junior_counter, junior_prefix,
                )
                students_created += new_students

        for level, name in SENIOR_LEVELS:
            cls, created = SchoolClass.objects.get_or_create(level=level, board=board, defaults={"name": name})
            classes_created += created
            for stream in SENIOR_STREAMS:
                for section_name in ["A", "B"]:
                    section, section_created = Section.objects.get_or_create(
                        school_class=cls, name=section_name, stream=stream, combination=None,
                    )
                    sections_created += section_created
                    senior_counter, new_students = _seed_students(
                        section, level, senior_counter, senior_prefix, stream=stream,
                    )
                    students_created += new_students

    command.stdout.write(command.style.SUCCESS(
        f"Done. {classes_created} class(es), {sections_created} section(s), "
        f"{students_created} student(s) newly created for the {board} board "
        f"(anything already there was left as-is)."
    ))


def _seed_students(section, level, counter, id_prefix, stream=None):
    """Creates up to STUDENTS_PER_SECTION students in this section. counter
    is a running index within this division (junior or senior), used to
    build deterministic, collision-free student_ids under id_prefix and to
    vary names/addresses — always advances by STUDENTS_PER_SECTION
    regardless of how many were actually new, so ids stay stable across
    re-runs. Returns (updated counter, number of students actually created)."""
    age = AGE_BY_LEVEL[level]
    created_count = 0
    for i in range(STUDENTS_PER_SECTION):
        counter += 1
        student_id = f"{id_prefix}{counter:03d}"
        if Student.objects.filter(student_id=student_id).exists():
            continue
        is_male = counter % 2 == 1
        first_name = (FIRST_NAMES_M if is_male else FIRST_NAMES_F)[counter % 10]
        last_name = LAST_NAMES[counter % 10]
        parent_first = PARENT_FIRST_NAMES_M[counter % 10]
        area = AREAS[counter % len(AREAS)]
        dob = date(ADMISSION_DATE.year - age, 1 + (counter % 12), 1 + (counter % 28))
        Student.objects.create(
            student_id=student_id,
            first_name=first_name,
            last_name=last_name,
            dob=dob,
            gender="Male" if is_male else "Female",
            admission_date=ADMISSION_DATE,
            current_class=section.school_class,
            current_section=section,
            stream=stream,
            combination=None,
            parent_name=f"{parent_first} {last_name}",
            parent_contact=f"98765{counter:05d}",
            address=f"{10 + counter}, {area}, Andhra Pradesh",
            roll_number=f"{i + 1:02d}",
        )
        created_count += 1
    return counter, created_count
