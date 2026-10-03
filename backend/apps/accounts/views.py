import logging

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db.models import Q
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AuditLog, Permission, Role, User
from .permissions import IsSuperAdmin
from .serializers import (
    AuditLogSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PermissionSerializer,
    RoleSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)

# Generic response for password-reset-request — identical whether or not a
# matching account was found, so this endpoint can't be used to enumerate
# valid usernames/emails.
_RESET_REQUESTED_DETAIL = (
    "If an account matches, a password reset link has been sent to it."
)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsSuperAdmin]

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response(
                {"detail": "This is a built-in system role and cannot be deleted."},
                status=400,
            )
        user_count = role.users.count()
        if user_count:
            return Response(
                {"detail": f"Cannot delete this role: {user_count} user(s) are still assigned to it."},
                status=400,
            )
        return super().destroy(request, *args, **kwargs)


class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsSuperAdmin]


class UserViewSet(viewsets.ModelViewSet):
    """Only Super Admin manages user accounts (passwords, roles, activation) —
    every other role's self-service profile access goes through MeView."""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsSuperAdmin]


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsSuperAdmin]


class PasswordResetRequestView(APIView):
    """Step 1 of "Forgot password": the person submits their username or
    email; if it matches an active account we email a one-time reset link.
    Always returns the same success message either way — see
    `_RESET_REQUESTED_DETAIL` — so this can't be used to check which
    accounts exist. Open to anyone (no login), since the whole point is
    they're locked out."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["username_or_email"].strip()

        user = (
            User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier))
            .filter(is_active=True)
            .first()
        )

        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_link = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password/{uid}/{token}/"

            try:
                send_mail(
                    subject="Reset your School ERP password",
                    message=(
                        f"Hi {user.first_name or user.username},\n\n"
                        f"Someone (hopefully you) asked to reset the password for the account "
                        f"\"{user.username}\".\n\n"
                        f"Click this link to set a new password — it works once and expires soon:\n"
                        f"{reset_link}\n\n"
                        f"If you didn't request this, you can ignore this email."
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email or user.username],
                    fail_silently=False,
                )
            except Exception:
                # Don't let an email-delivery failure (e.g. SMTP not
                # configured yet) surface to the caller as an error — that
                # would leak whether the account existed. Log it instead so
                # whoever's running the server can see what happened
                # (console backend prints the message anyway).
                logger.exception("Could not send password reset email for user id=%s", user.pk)

        return Response({"detail": _RESET_REQUESTED_DETAIL})


class PasswordResetConfirmView(APIView):
    """Step 2: the person follows the emailed link (uid + token in the URL)
    and submits a new password. The token is single-use in effect — Django's
    default_token_generator bakes the user's current password hash into it,
    so it stops validating the moment this succeeds once."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = serializer.validated_data["uid"]
        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["new_password"]

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            user = None

        if not user or not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "This reset link is invalid or has expired. Request a new one."},
                status=400,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated. You can now log in with your new password."})
