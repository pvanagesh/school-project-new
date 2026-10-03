from rest_framework.permissions import SAFE_METHODS, BasePermission


class HasRole(BasePermission):
    """Allow access only to users whose role is in `allowed_roles`.

    Usage: set `allowed_roles = ("SUPER_ADMIN", "PRINCIPAL")` on the view,
    or subclass e.g. `IsSuperAdmin` below.
    """

    allowed_roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        allowed = getattr(view, "allowed_roles", self.allowed_roles)
        if not allowed:
            return True
        role = getattr(request.user, "role", None)
        return bool(role and role.name in allowed)


class IsSuperAdmin(HasRole):
    allowed_roles = ("SUPER_ADMIN",)


class IsAdminOrPrincipal(HasRole):
    allowed_roles = ("SUPER_ADMIN", "PRINCIPAL")


class DenyTeacherWrite(BasePermission):
    """Teachers/Class Teachers get read-only access on views that use this.
    Write access to their own data (attendance, marks) is handled by
    dedicated scoped viewsets instead, not by this permission."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        from apps.teachers.scoping import is_teacher_role

        return not is_teacher_role(request.user)


class RolesRequiredForWrite(BasePermission):
    """Any authenticated user can read; only `write_roles` can create,
    update, or delete. Subclass and set `write_roles`."""

    write_roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        role = getattr(request.user, "role", None)
        return bool(role and role.name in self.write_roles)


class IsSuperAdminOrReadOnly(RolesRequiredForWrite):
    write_roles = ("SUPER_ADMIN",)


class IsAdminOrAccountantForWrite(RolesRequiredForWrite):
    write_roles = ("SUPER_ADMIN", "ACCOUNTANT")
