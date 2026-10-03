"""One-off recovery command — restores ALL FIVE teachers lost to the
Teachers-page / Users & Roles delete-icon UX bug on 2026-08-23, in one run:

  EMP001 teacher001  Lakshmi Devi   (role CLASS_TEACHER, Class Teacher of section 10)
  EMP002 teacher002  Ramesh Kumar   (role CLASS_TEACHER, Class Teacher of section 1)
  EMP003 teacher003  Suresh Rao     (role TEACHER,       Class Teacher of section 2)
  EMP004 teacher004  Anitha Reddy   (role TEACHER,       Class Teacher of section 3)
  EMP005 teacher005  Prasad Naidu   (role TEACHER,       Class Teacher of section 4)

This supersedes running restore_emp001 / restore_emp003 / restore_emp004_emp005
separately — it does the same get_or_create-based restore for all five in a
single command, so you only need to run one thing. The individual commands
are left in place too and are safe to run either way; nothing here overwrites
anything that already exists.

Usage (from backend/, with the venv active):
    python manage.py restore_missing_teachers
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role, User
from apps.academics.models import Section, Timetable
from apps.teachers.models import Teacher

TEACHERS = [
    {
        "teacher_id": "EMP001",
        "username": "teacher001",
        "email": "lakshmi.devi@vedhaschool.edu.in",
        "first_name": "Lakshmi",
        "last_name": "Devi",
        "qualification": "Not provided",
        "experience_years": 0,
        "subject_specialization": "English",
        "contact": "9876543001",
        "joining_date": "2026-06-01",
        "password_hash": "pbkdf2_sha256$1200000$s2SpByt7p33fsugoeeDmzX$Gn5NRBWvknnPzJuDy0liTzD84BnqNSYIlSPSVBbhoZ8=",
        "role_name": "CLASS_TEACHER",
        "class_teacher_of_section_id": 10,
    },
    {
        "teacher_id": "EMP002",
        "username": "teacher002",
        "email": "ramesh.kumar@vedhaschool.edu.in",
        "first_name": "Ramesh",
        "last_name": "Kumar",
        "qualification": "Not provided",
        "experience_years": 0,
        "subject_specialization": "Mathematics",
        "contact": "9876543002",
        "joining_date": "2026-06-01",
        "password_hash": "pbkdf2_sha256$1200000$UqReEStuUhVGmc29TOHfgw$+/rAlrLLx5p6b5IYXJEk74vY8+N2LJRt0AfRvJj0axc=",
        "role_name": "CLASS_TEACHER",
        "class_teacher_of_section_id": 1,
    },
    {
        "teacher_id": "EMP003",
        "username": "teacher003",
        "email": "teacher003@vedhaschool.edu.in",
        "first_name": "Suresh",
        "last_name": "Rao",
        "qualification": "Not provided",
        "experience_years": 0,
        "subject_specialization": "Environmental Studies",
        "contact": "Not provided",
        "joining_date": "2026-06-01",
        "password_hash": "pbkdf2_sha256$1200000$AfDeCFOlx7Sp4D0GkXgUyC$QM7j5mO15Kh+zyNqXcyoWpEnro4/kAlswuO4nuJxl4g=",
        "role_name": "TEACHER",
        "class_teacher_of_section_id": 2,
    },
    {
        "teacher_id": "EMP004",
        "username": "teacher004",
        "email": "teacher004@vedhaschool.edu.in",
        "first_name": "Anitha",
        "last_name": "Reddy",
        "qualification": "Not provided",
        "experience_years": 0,
        "subject_specialization": "Science",
        "contact": "Not provided",
        "joining_date": "2026-06-01",
        "password_hash": "pbkdf2_sha256$1200000$Qpwyfn1YfFsjnKAZwcqa5x$as8McLYsb5DaFiYXV0zJQe+ed7/GE26o5XeWVZyvYj0=",
        "role_name": "TEACHER",
        "class_teacher_of_section_id": 3,
    },
    {
        "teacher_id": "EMP005",
        "username": "teacher005",
        "email": "teacher005@vedhaschool.edu.in",
        "first_name": "Prasad",
        "last_name": "Naidu",
        "qualification": "Not provided",
        "experience_years": 0,
        "subject_specialization": "Social Science",
        "contact": "Not provided",
        "joining_date": "2026-06-01",
        "password_hash": "pbkdf2_sha256$1200000$m8MBgdMQ9MbfWRLi5cLnnn$zTK9GyftSLS4IBzGHpF+VeBdmrpM4wDfHeR+RD+bjC8=",
        "role_name": "TEACHER",
        "class_teacher_of_section_id": 4,
    },
]

TIMETABLE_ROWS = {
    "EMP001": [
        {'section': 2, 'subject': 53, 'day_of_week': 'TUE', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 3, 'subject': 53, 'day_of_week': 'WED', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 4, 'subject': 53, 'day_of_week': 'THU', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 5, 'subject': 53, 'day_of_week': 'FRI', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-006'},
        {'section': 6, 'subject': 53, 'day_of_week': 'SAT', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-007'},
        {'section': 8, 'subject': 53, 'day_of_week': 'MON', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-008'},
        {'section': 9, 'subject': 53, 'day_of_week': 'TUE', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-009'},
        {'section': 10, 'subject': 53, 'day_of_week': 'WED', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-001'},
        {'section': 11, 'subject': 53, 'day_of_week': 'THU', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-032'},
        {'section': 12, 'subject': 53, 'day_of_week': 'FRI', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-010'},
        {'section': 13, 'subject': 53, 'day_of_week': 'SAT', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-011'},
        {'section': 14, 'subject': 53, 'day_of_week': 'MON', 'period': 3, 'start_time': '10:20:00', 'end_time': '11:00:00', 'classroom': 'Class-012'},
        {'section': 15, 'subject': 53, 'day_of_week': 'TUE', 'period': 3, 'start_time': '10:20:00', 'end_time': '11:00:00', 'classroom': 'Class-013'},
        {'section': 16, 'subject': 53, 'day_of_week': 'WED', 'period': 3, 'start_time': '10:20:00', 'end_time': '11:00:00', 'classroom': 'Class-014'},
        {'section': 17, 'subject': 53, 'day_of_week': 'THU', 'period': 3, 'start_time': '10:20:00', 'end_time': '11:00:00', 'classroom': 'Class-015'},
        {'section': 18, 'subject': 53, 'day_of_week': 'FRI', 'period': 3, 'start_time': '10:20:00', 'end_time': '11:00:00', 'classroom': 'Class-016'},
        {'section': 19, 'subject': 53, 'day_of_week': 'SAT', 'period': 3, 'start_time': '10:20:00', 'end_time': '11:00:00', 'classroom': 'Class-017'},
        {'section': 20, 'subject': 53, 'day_of_week': 'MON', 'period': 4, 'start_time': '11:00:00', 'end_time': '11:40:00', 'classroom': 'Class-018'},
        {'section': 21, 'subject': 53, 'day_of_week': 'TUE', 'period': 4, 'start_time': '11:00:00', 'end_time': '11:40:00', 'classroom': 'Class-019'},
        {'section': 22, 'subject': 53, 'day_of_week': 'WED', 'period': 4, 'start_time': '11:00:00', 'end_time': '11:40:00', 'classroom': 'Class-020'},
        {'section': 23, 'subject': 53, 'day_of_week': 'THU', 'period': 4, 'start_time': '11:00:00', 'end_time': '11:40:00', 'classroom': 'Class-021'},
        {'section': 24, 'subject': 53, 'day_of_week': 'FRI', 'period': 4, 'start_time': '11:00:00', 'end_time': '11:40:00', 'classroom': 'Class-022'},
        {'section': 25, 'subject': 53, 'day_of_week': 'SAT', 'period': 4, 'start_time': '11:00:00', 'end_time': '11:40:00', 'classroom': 'Class-023'},
        {'section': 1, 'subject': 53, 'day_of_week': 'MON', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 53, 'day_of_week': 'TUE', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 53, 'day_of_week': 'WED', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 2, 'subject': 53, 'day_of_week': 'MON', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 2, 'subject': 53, 'day_of_week': 'THU', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 3, 'subject': 53, 'day_of_week': 'FRI', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 53, 'day_of_week': 'SAT', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
    ],
    "EMP002": [
        {'section': 2, 'subject': 9, 'day_of_week': 'TUE', 'period': 5, 'start_time': '11:40:00', 'end_time': '12:20:00', 'classroom': 'Class-003'},
        {'section': 3, 'subject': 9, 'day_of_week': 'WED', 'period': 5, 'start_time': '11:40:00', 'end_time': '12:20:00', 'classroom': 'Class-004'},
        {'section': 4, 'subject': 9, 'day_of_week': 'THU', 'period': 5, 'start_time': '11:40:00', 'end_time': '12:20:00', 'classroom': 'Class-005'},
        {'section': 5, 'subject': 9, 'day_of_week': 'FRI', 'period': 5, 'start_time': '11:40:00', 'end_time': '12:20:00', 'classroom': 'Class-006'},
        {'section': 6, 'subject': 9, 'day_of_week': 'SAT', 'period': 5, 'start_time': '11:40:00', 'end_time': '12:20:00', 'classroom': 'Class-007'},
        {'section': 8, 'subject': 9, 'day_of_week': 'MON', 'period': 6, 'start_time': '12:20:00', 'end_time': '13:00:00', 'classroom': 'Class-008'},
        {'section': 9, 'subject': 9, 'day_of_week': 'TUE', 'period': 6, 'start_time': '12:20:00', 'end_time': '13:00:00', 'classroom': 'Class-009'},
        {'section': 10, 'subject': 9, 'day_of_week': 'WED', 'period': 6, 'start_time': '12:20:00', 'end_time': '13:00:00', 'classroom': 'Class-001'},
        {'section': 11, 'subject': 9, 'day_of_week': 'THU', 'period': 6, 'start_time': '12:20:00', 'end_time': '13:00:00', 'classroom': 'Class-032'},
        {'section': 12, 'subject': 9, 'day_of_week': 'FRI', 'period': 6, 'start_time': '12:20:00', 'end_time': '13:00:00', 'classroom': 'Class-010'},
        {'section': 13, 'subject': 9, 'day_of_week': 'SAT', 'period': 6, 'start_time': '12:20:00', 'end_time': '13:00:00', 'classroom': 'Class-011'},
        {'section': 14, 'subject': 9, 'day_of_week': 'MON', 'period': 7, 'start_time': '13:00:00', 'end_time': '13:40:00', 'classroom': 'Class-012'},
        {'section': 15, 'subject': 9, 'day_of_week': 'TUE', 'period': 7, 'start_time': '13:00:00', 'end_time': '13:40:00', 'classroom': 'Class-013'},
        {'section': 16, 'subject': 9, 'day_of_week': 'WED', 'period': 7, 'start_time': '13:00:00', 'end_time': '13:40:00', 'classroom': 'Class-014'},
        {'section': 17, 'subject': 9, 'day_of_week': 'THU', 'period': 7, 'start_time': '13:00:00', 'end_time': '13:40:00', 'classroom': 'Class-015'},
        {'section': 18, 'subject': 9, 'day_of_week': 'FRI', 'period': 7, 'start_time': '13:00:00', 'end_time': '13:40:00', 'classroom': 'Class-016'},
        {'section': 19, 'subject': 9, 'day_of_week': 'SAT', 'period': 7, 'start_time': '13:00:00', 'end_time': '13:40:00', 'classroom': 'Class-017'},
        {'section': 20, 'subject': 9, 'day_of_week': 'MON', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-018'},
        {'section': 21, 'subject': 9, 'day_of_week': 'TUE', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-019'},
        {'section': 22, 'subject': 9, 'day_of_week': 'WED', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-020'},
        {'section': 23, 'subject': 9, 'day_of_week': 'THU', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-021'},
        {'section': 24, 'subject': 9, 'day_of_week': 'FRI', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-022'},
        {'section': 25, 'subject': 9, 'day_of_week': 'SAT', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-023'},
        {'section': 1, 'subject': 9, 'day_of_week': 'MON', 'period': 5, 'start_time': '13:00:00', 'end_time': '13:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 25, 'day_of_week': 'MON', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 22, 'day_of_week': 'MON', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 9, 'day_of_week': 'TUE', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 23, 'day_of_week': 'TUE', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 9, 'day_of_week': 'WED', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 22, 'day_of_week': 'WED', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 23, 'day_of_week': 'WED', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 9, 'day_of_week': 'THU', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 22, 'day_of_week': 'THU', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 9, 'day_of_week': 'FRI', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 23, 'day_of_week': 'FRI', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 25, 'day_of_week': 'SAT', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
    ],
    "EMP003": [
        {'section': 5, 'subject': 13, 'day_of_week': 'MON', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-006'},
        {'section': 6, 'subject': 13, 'day_of_week': 'TUE', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-007'},
        {'section': 8, 'subject': 13, 'day_of_week': 'WED', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-008'},
        {'section': 9, 'subject': 13, 'day_of_week': 'THU', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-009'},
        {'section': 10, 'subject': 13, 'day_of_week': 'FRI', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-001'},
        {'section': 11, 'subject': 13, 'day_of_week': 'SAT', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-032'},
        {'section': 12, 'subject': 13, 'day_of_week': 'MON', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-010'},
        {'section': 13, 'subject': 13, 'day_of_week': 'TUE', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-011'},
        {'section': 14, 'subject': 13, 'day_of_week': 'WED', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-012'},
        {'section': 15, 'subject': 13, 'day_of_week': 'THU', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-013'},
        {'section': 4, 'subject': 13, 'day_of_week': 'MON', 'period': 4, 'start_time': '09:00:00', 'end_time': '10:00:00', 'classroom': 'Class-005'},
        {'section': 1, 'subject': 13, 'day_of_week': 'MON', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 13, 'day_of_week': 'TUE', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 1, 'subject': 13, 'day_of_week': 'THU', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-002'},
        {'section': 2, 'subject': 13, 'day_of_week': 'TUE', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 2, 'subject': 25, 'day_of_week': 'WED', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 2, 'subject': 22, 'day_of_week': 'WED', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 2, 'subject': 23, 'day_of_week': 'THU', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 2, 'subject': 13, 'day_of_week': 'FRI', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 2, 'subject': 25, 'day_of_week': 'FRI', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 2, 'subject': 22, 'day_of_week': 'FRI', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 2, 'subject': 23, 'day_of_week': 'SAT', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 2, 'subject': 13, 'day_of_week': 'SAT', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 2, 'subject': 25, 'day_of_week': 'SAT', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-003'},
        {'section': 3, 'subject': 13, 'day_of_week': 'TUE', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 4, 'subject': 13, 'day_of_week': 'WED', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 13, 'day_of_week': 'SAT', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
    ],
    "EMP004": [
        {'section': 20, 'subject': 14, 'day_of_week': 'FRI', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 40, 'day_of_week': 'FRI', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 25, 'day_of_week': 'FRI', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 22, 'day_of_week': 'FRI', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 16, 'subject': 14, 'day_of_week': 'MON', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 22, 'subject': 14, 'day_of_week': 'MON', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 40, 'day_of_week': 'MON', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 25, 'day_of_week': 'MON', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 21, 'subject': 14, 'day_of_week': 'SAT', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 23, 'day_of_week': 'SAT', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 9, 'day_of_week': 'SAT', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 19, 'subject': 14, 'day_of_week': 'THU', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 25, 'subject': 14, 'day_of_week': 'THU', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 22, 'day_of_week': 'THU', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 23, 'day_of_week': 'THU', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 17, 'subject': 14, 'day_of_week': 'TUE', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 23, 'subject': 14, 'day_of_week': 'TUE', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 22, 'day_of_week': 'TUE', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 23, 'day_of_week': 'TUE', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 18, 'subject': 14, 'day_of_week': 'WED', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Lab-001'},
        {'section': 24, 'subject': 14, 'day_of_week': 'WED', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Lab-001'},
        {'section': 3, 'subject': 40, 'day_of_week': 'WED', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
        {'section': 3, 'subject': 25, 'day_of_week': 'WED', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-004'},
    ],
    "EMP005": [
        {'section': 21, 'subject': 15, 'day_of_week': 'FRI', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-019'},
        {'section': 4, 'subject': 40, 'day_of_week': 'FRI', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 25, 'day_of_week': 'FRI', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 22, 'day_of_week': 'FRI', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 17, 'subject': 15, 'day_of_week': 'MON', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-015'},
        {'section': 23, 'subject': 15, 'day_of_week': 'MON', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-021'},
        {'section': 4, 'subject': 40, 'day_of_week': 'MON', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 25, 'day_of_week': 'MON', 'period': 5, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 20, 'subject': 15, 'day_of_week': 'SAT', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-018'},
        {'section': 4, 'subject': 23, 'day_of_week': 'SAT', 'period': 2, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 9, 'day_of_week': 'SAT', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 53, 'day_of_week': 'SAT', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 18, 'subject': 15, 'day_of_week': 'THU', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-016'},
        {'section': 24, 'subject': 15, 'day_of_week': 'THU', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-022'},
        {'section': 4, 'subject': 22, 'day_of_week': 'THU', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 23, 'day_of_week': 'THU', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 16, 'subject': 15, 'day_of_week': 'TUE', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-014'},
        {'section': 22, 'subject': 15, 'day_of_week': 'TUE', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-020'},
        {'section': 4, 'subject': 22, 'day_of_week': 'TUE', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 23, 'day_of_week': 'TUE', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 19, 'subject': 15, 'day_of_week': 'WED', 'period': 1, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-017'},
        {'section': 25, 'subject': 15, 'day_of_week': 'WED', 'period': 2, 'start_time': '09:40:00', 'end_time': '10:20:00', 'classroom': 'Class-023'},
        {'section': 4, 'subject': 40, 'day_of_week': 'WED', 'period': 3, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
        {'section': 4, 'subject': 25, 'day_of_week': 'WED', 'period': 4, 'start_time': '09:00:00', 'end_time': '09:40:00', 'classroom': 'Class-005'},
    ],
}


class Command(BaseCommand):
    help = "Restores teacher001, teacher002, teacher003, teacher004, and teacher005 plus their timetables, from mysql_dump.json."

    def handle(self, *args, **options):
        with transaction.atomic():
            for t in TEACHERS:
                self._restore_one(t)
        self.stdout.write(self.style.SUCCESS("Done."))

    def _restore_one(self, t):
        self.stdout.write(f"--- {t['teacher_id']} ({t['first_name']} {t['last_name']}) ---")

        user, user_created = User.objects.get_or_create(
            username=t["username"],
            defaults={
                "password": t["password_hash"],
                "first_name": t["first_name"],
                "last_name": t["last_name"],
                "email": t["email"],
                "is_active": True,
                "role": Role.objects.get(name=t["role_name"]),
                "phone": t["contact"],
            },
        )
        if user_created:
            self.stdout.write(f"  user {t['username']}: created, original password restored")
        else:
            self.stdout.write(f"  user {t['username']}: already existed, left as-is")

        teacher, teacher_created = Teacher.objects.get_or_create(
            teacher_id=t["teacher_id"],
            defaults={
                "user": user,
                "first_name": t["first_name"],
                "last_name": t["last_name"],
                "qualification": t["qualification"],
                "experience_years": t["experience_years"],
                "subject_specialization": t["subject_specialization"],
                "contact": t["contact"],
                "joining_date": t["joining_date"],
            },
        )
        self.stdout.write(f"  teacher profile: {'created' if teacher_created else 'already existed, left as-is'}")

        restored, skipped = 0, 0
        for row in TIMETABLE_ROWS[t["teacher_id"]]:
            section_id = row["section"]
            if not Section.objects.filter(id=section_id).exists():
                self.stdout.write(self.style.WARNING(
                    f"  section id {section_id} no longer exists — skipped {row['day_of_week']} P{row['period']}"
                ))
                skipped += 1
                continue
            _, created = Timetable.objects.get_or_create(
                section_id=section_id,
                day_of_week=row["day_of_week"],
                period=row["period"],
                defaults={
                    "subject_id": row["subject"],
                    "teacher": teacher,
                    "start_time": row["start_time"],
                    "end_time": row["end_time"],
                    "classroom": row["classroom"],
                },
            )
            if created:
                restored += 1
            else:
                skipped += 1
                self.stdout.write(self.style.WARNING(
                    f"  section {section_id} {row['day_of_week']} P{row['period']} is already occupied — left as-is"
                ))
        self.stdout.write(f"  timetable: {restored} slot(s) restored, {skipped} skipped")

        section = Section.objects.filter(id=t["class_teacher_of_section_id"]).first()
        if not section:
            self.stdout.write(self.style.WARNING(
                f"  section id {t['class_teacher_of_section_id']} no longer exists — can't restore Class Teacher"
            ))
        elif section.class_teacher_id is None:
            section.class_teacher = teacher
            section.save(update_fields=["class_teacher"])
            self.stdout.write(f"  set as Class Teacher of section id {section.id}")
        elif section.class_teacher_id == teacher.id:
            self.stdout.write("  already Class Teacher of their section")
        else:
            self.stdout.write(self.style.WARNING(
                f"  section id {section.id} already has a different Class Teacher — left as-is"
            ))
