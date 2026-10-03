"""Restricts every non-Super-Admin STAFF role (Principal, Teacher, Class
Teacher, Accountant) to one of the school's 4 "divisions" — a board
(CBSE/SSC) x class-level-group (junior 1-10 / senior 11-12) combination —
via the assigned_board/assigned_group fields on accounts.User. Super Admin
is the only role that ever sees every division at once.

A staff account that hasn't been assigned a division yet is scoped to
nothing (fails closed) rather than everything, so a half set-up account
can't accidentally see data it shouldn't.

This is a separate, coarser layer from apps.teachers.scoping (which
restricts a Teacher/Class Teacher further, to only the sections/subjects
they actually teach per the Timetable) — the two compose: a Teacher's
effective visibility is "their division" AND "what they actually teach"."""

SENIOR_LEVELS = ("11", "12")
JUNIOR_LEVELS = ("LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10")

DIVISION_SCOPED_ROLES = ("PRINCIPAL", "TEACHER", "CLASS_TEACHER", "ACCOUNTANT")


def levels_for_group(group):
    return SENIOR_LEVELS if group == "SENIOR" else JUNIOR_LEVELS


def is_super_admin(user):
    role = getattr(user, "role", None)
    return bool(role and role.name == "SUPER_ADMIN")


def needs_division_scope(user):
    role = getattr(user, "role", None)
    return bool(role and role.name in DIVISION_SCOPED_ROLES)


def user_division(user):
    """Returns (board, group) for a division-scoped staff user; False if
    they need a division but don't have one assigned yet (fail closed —
    callers should treat this as "sees nothing"); or None if this user
    isn't division-scoped at all (Super Admin, or a role outside the 4
    staff roles above) and should see every division unfiltered."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not needs_division_scope(user):
        return None
    board = getattr(user, "assigned_board", None)
    group = getattr(user, "assigned_group", None)
    if not board or not group:
        return False
    return board, group


def filter_classes_by_division(qs, user, *, prefix=""):
    """Filters a queryset that is (or relates to) academics.SchoolClass down
    to the user's assigned division. `prefix` is the ORM lookup path to
    SchoolClass — "" if qs is itself a SchoolClass queryset, otherwise e.g.
    "school_class__", "current_class__", "student__current_class__"."""
    division = user_division(user)
    if division is None:
        return qs
    if division is False:
        return qs.none()
    board, group = division
    return qs.filter(**{f"{prefix}board": board, f"{prefix}level__in": levels_for_group(group)})


def filter_staff_by_division(qs, user, *, prefix=""):
    """Filters a queryset of (or related to) accounts.User representing
    OTHER staff members — e.g. the Teachers list — down to staff tagged
    with the same division as the requesting user. There's no class
    relation to walk here, so this compares division tags directly instead
    of going through filter_classes_by_division."""
    division = user_division(user)
    if division is None:
        return qs
    if division is False:
        return qs.none()
    board, group = division
    return qs.filter(**{f"{prefix}assigned_board": board, f"{prefix}assigned_group": group})
