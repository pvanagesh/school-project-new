from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.models import UIDModel


class Permission(UIDModel):
    codename = models.SlugField(max_length=100, unique=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Role(UIDModel):
    """Role names are free-form (not a closed enum): the 7 Phase-1 spec roles
    (SUPER_ADMIN, PRINCIPAL, TEACHER, CLASS_TEACHER, STUDENT, PARENT, ACCOUNTANT)
    are seeded via migration with is_system=True, which protects them from
    deletion (see RoleViewSet.destroy) since permission checks and frontend
    nav-gating key off these exact name strings. They can still be renamed;
    is_system tracks origin, not the current name.
    """

    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False, editable=False)
    permissions = models.ManyToManyField(Permission, blank=True, related_name="roles")

    def __str__(self):
        return self.name


class User(UIDModel, AbstractUser):
    class AssignedBoard(models.TextChoices):
        CBSE = "CBSE", "CBSE"
        SSC = "SSC", "SSC (State Board)"

    class AssignedGroup(models.TextChoices):
        JUNIOR = "JUNIOR", "Classes 1-10"
        SENIOR = "SENIOR", "11th & 12th"

    role = models.ForeignKey(Role, on_delete=models.PROTECT, null=True, blank=True, related_name="users")
    phone = models.CharField(max_length=20, blank=True)
    # Which of the school's 4 "divisions" (board x junior/senior) this staff
    # member is confined to. Only meaningful for PRINCIPAL, TEACHER,
    # CLASS_TEACHER and ACCOUNTANT — see apps.accounts.scoping. Null for
    # Super Admin (sees every division) and for roles this doesn't apply to
    # (STUDENT, PARENT, whose own record already scopes what they see).
    assigned_board = models.CharField(max_length=10, choices=AssignedBoard.choices, null=True, blank=True)
    assigned_group = models.CharField(max_length=10, choices=AssignedGroup.choices, null=True, blank=True)

    def __str__(self):
        return self.username


class AuditLog(UIDModel):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    action = models.CharField(max_length=150)
    target_model = models.CharField(max_length=100, blank=True)
    target_id = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} by {self.user} @ {self.created_at:%Y-%m-%d %H:%M}"
