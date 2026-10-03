"""Copies CBSE's CURRENT curriculum (whatever it is right now — not a fixed
seed list) onto SSC, matching classes by level.

Why this exists: only CBSE's curriculum was ever seeded (see
seed_baseline_reference_data's docstring); SSC's own curriculum was left as
"a separate, not-yet-built piece of work". This command builds it by
mirroring CBSE's: for every CBSE ClassStreamProfile (a class, or a class +
stream + combination for 11/12), it finds the SSC SchoolClass with the same
level and creates the matching SSC ClassStreamProfile there, then copies
every one of that CBSE profile's ProfileSubject rows (same subject, same
Mandatory/Optional/Co-Scholastic category) onto it.

Requires the SSC SchoolClass rows to already exist (e.g. from
seed_ssc_division) — a CBSE level with no matching SSC class is skipped and
reported, not created here, since creating classes isn't this command's job.

Idempotent — every profile and subject link is get_or_create, so this is
safe to re-run any time CBSE's curriculum changes and you want SSC to catch
up to it again. It only ever adds; it never removes an SSC subject link
that isn't (or is no longer) on the matching CBSE profile, so anything
you've customized on the SSC side by hand is left alone.

Usage (from backend/, with the venv active):
    python manage.py mirror_cbse_curriculum_to_ssc
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.academics.models import ClassStreamProfile, ProfileSubject, SchoolClass


class Command(BaseCommand):
    help = "Copies CBSE's current curriculum (classes/streams and their subjects) onto SSC, matching by class level."

    def handle(self, *args, **options):
        cbse_profiles = (
            ClassStreamProfile.objects.filter(board="CBSE")
            .select_related("school_class")
            .prefetch_related("subjects__subject")
            .order_by("school_class__id", "stream", "combination")
        )

        if not cbse_profiles.exists():
            raise CommandError("No CBSE curriculum found to copy from — set up CBSE's curriculum first.")

        profiles_created = profiles_already_there = 0
        subjects_created = subjects_already_there = 0
        skipped_levels = set()

        with transaction.atomic():
            for cbse_profile in cbse_profiles:
                level = cbse_profile.school_class.level
                ssc_class = SchoolClass.objects.filter(level=level, board="SSC").first()
                if not ssc_class:
                    skipped_levels.add(level)
                    continue

                ssc_profile, profile_was_created = ClassStreamProfile.objects.get_or_create(
                    school_class=ssc_class,
                    stream=cbse_profile.stream,
                    combination=cbse_profile.combination,
                    board="SSC",
                )
                if profile_was_created:
                    profiles_created += 1
                else:
                    profiles_already_there += 1

                for profile_subject in cbse_profile.subjects.all():
                    _, subject_link_created = ProfileSubject.objects.get_or_create(
                        profile=ssc_profile,
                        subject=profile_subject.subject,
                        category=profile_subject.category,
                    )
                    if subject_link_created:
                        subjects_created += 1
                    else:
                        subjects_already_there += 1

        if skipped_levels:
            self.stdout.write(self.style.WARNING(
                f"Skipped level(s) with no SSC class yet: {', '.join(sorted(skipped_levels))} — "
                "run seed_ssc_division, or add the class on Classes & Sections, then re-run this command."
            ))

        self.stdout.write(self.style.SUCCESS(
            f"Done. {profiles_created} new SSC curriculum profile(s) created "
            f"({profiles_already_there} already existed), "
            f"{subjects_created} new subject link(s) added "
            f"({subjects_already_there} were already there)."
        ))
