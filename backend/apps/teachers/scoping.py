"""Restricts Teacher/Class Teacher role users to the sections and subjects
they actually teach. There's no separate 'homeroom' concept in the data
model, so both roles are scoped identically, derived from their Timetable
assignments (teacher + section + subject triples)."""

TEACHER_ROLES = ("TEACHER", "CLASS_TEACHER")


def is_teacher_role(user):
    role = getattr(user, "role", None)
    return bool(role and role.name in TEACHER_ROLES)


def teacher_profile_of(user):
    return getattr(user, "teacher_profile", None)


def teacher_section_ids(user):
    teacher = teacher_profile_of(user)
    if not teacher:
        return set()
    from apps.academics.models import Timetable

    return set(Timetable.objects.filter(teacher=teacher).values_list("section_id", flat=True))


def teacher_section_subject_pairs(user):
    teacher = teacher_profile_of(user)
    if not teacher:
        return set()
    from apps.academics.models import Timetable

    return set(Timetable.objects.filter(teacher=teacher).values_list("section_id", "subject_id"))


# Maps Python's date.weekday() (0=Monday..6=Sunday) to the Timetable.Day
# 3-letter codes. Index 6 (SUN) never matches a real slot since the
# timetable only defines MON-SAT, which is fine — it just means no teacher
# is ever eligible to mark attendance on a Sunday.
_WEEKDAY_CODES = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")


def day_code_for_date(date_obj):
    return _WEEKDAY_CODES[date_obj.weekday()]


def teacher_period1_section_ids(user, day_of_week):
    """Sections where this teacher has Period 1 on the given day, per the
    timetable. Daily attendance is taken by whichever teacher has first
    period with a section — Class Teacher or not — so this (not
    teacher_section_ids, which covers every period) is the eligibility
    check for marking/editing attendance."""
    teacher = teacher_profile_of(user)
    if not teacher:
        return set()
    from apps.academics.models import Timetable

    return set(
        Timetable.objects.filter(teacher=teacher, period=1, day_of_week=day_of_week).values_list(
            "section_id", flat=True
        )
    )


def teacher_is_class_teacher_of(user, section_id):
    """Whether this user is the Class Teacher (Section.class_teacher) of the
    given section — the other route (besides having Period 1 that day) into
    being allowed to mark that section's daily attendance."""
    teacher = teacher_profile_of(user)
    if not teacher:
        return False
    from apps.academics.models import Section

    return Section.objects.filter(id=section_id, class_teacher=teacher).exists()


def teacher_class_teacher_section_ids(user):
    """Sections where this user is the Class Teacher — independent of
    Timetable, since being a homeroom's Class Teacher doesn't require also
    having a period there. Used to widen read-scope so a Class Teacher can
    still see the attendance she's allowed to mark."""
    teacher = teacher_profile_of(user)
    if not teacher:
        return set()
    from apps.academics.models import Section

    return set(Section.objects.filter(class_teacher=teacher).values_list("id", flat=True))
