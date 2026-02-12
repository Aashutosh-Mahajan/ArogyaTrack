"""
Centralised RBAC permission classes for the Health Surveillance system.

Usage in any DRF view:
    permission_classes = [IsAuthenticated, IsDoctor]
    permission_classes = [IsAuthenticated, IsApprovedDoctor]
    permission_classes = [IsAuthenticated, IsPatient]
    permission_classes = [IsAuthenticated, IsAdmin]

These replace ALL scattered `if request.user.role == ...` checks.
"""

from rest_framework.permissions import BasePermission


# ─── Role-based permissions ──────────────────────────────────────────


class IsDoctor(BasePermission):
    """Allow any user with the Doctor role (approved or not)."""
    message = "Doctor role required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_doctor
        )


class IsApprovedDoctor(BasePermission):
    """Allow only doctors whose profile has been approved by an admin."""
    message = "Your doctor account is pending approval."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_approved_doctor
        )


class IsPatient(BasePermission):
    """Allow only users with the Patient role."""
    message = "Patient role required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_patient
        )


class IsAdmin(BasePermission):
    """Allow only users with the Admin role (or Django superusers)."""
    message = "Admin role required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_admin or request.user.is_superuser)
        )


# ─── Composite / convenience permissions ────────────────────────────


class IsDoctorOrAdmin(BasePermission):
    """Allow approved doctors OR admins."""
    message = "Doctor or Admin role required."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return user.is_approved_doctor or user.is_admin or user.is_superuser


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level: allow the owning user or an admin.
    The view's queryset object must expose a `.user` or `.user_id` attribute,
    OR supply `get_owner_id(obj)` on the view.
    """
    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_admin or user.is_superuser:
            return True
        # Check via a custom hook on the view first
        get_owner = getattr(view, "get_owner_id", None)
        if callable(get_owner):
            return get_owner(obj) == user.pk
        # Fall back to obj.user / obj.user_id
        owner_id = getattr(obj, "user_id", None) or getattr(getattr(obj, "user", None), "pk", None)
        return owner_id == user.pk


class IsDoctorVerified(BasePermission):
    """
    Blocks unapproved doctors from sensitive endpoints while letting
    patients and admins through. Attach *after* IsAuthenticated.
    """
    message = "Your doctor account is pending approval. Access restricted."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        # Only gate doctors; patients/admins pass through
        if user.is_doctor:
            return user.is_approved_doctor
        return True
