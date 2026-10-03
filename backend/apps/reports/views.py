from django.db.models import Count
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Section
from apps.accounts.scoping import filter_classes_by_division
from apps.attendance.models import Attendance
from apps.exams.models import AssessmentConfig, Exam, MarksEntry, SubjectMarksConfig
from apps.fees.models import Payment
from apps.students.models import Student


def _month_to_date_bounds(today):
    return today.replace(day=1), today


class AttendanceReportView(APIView):
    """Per-student attendance % over a date range, optionally filtered to one
    section or class. HALF_DAY counts as 0.5 present for the percentage."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        default_from, default_to = _month_to_date_bounds(today)
        date_from = request.query_params.get("date_from") or str(default_from)
        date_to = request.query_params.get("date_to") or str(default_to)

        students = filter_classes_by_division(
            Student.objects.select_related("current_class", "current_section"), request.user, prefix="current_class__"
        )
        section = request.query_params.get("section")
        school_class = request.query_params.get("class")
        if section:
            students = students.filter(current_section_id=section)
        elif school_class:
            students = students.filter(current_class_id=school_class)

        rows = []
        for student in students.order_by("current_class__id", "current_section__name", "first_name"):
            records = Attendance.objects.filter(student=student, date__gte=date_from, date__lte=date_to)
            counts = {status_value: 0 for status_value, _ in Attendance.Status.choices}
            for record in records:
                counts[record.status] += 1
            total_marked = sum(counts.values())
            present_equiv = counts["PRESENT"] + counts["LATE"] + 0.5 * counts["HALF_DAY"]
            percentage = round((present_equiv / total_marked) * 100, 2) if total_marked else None
            rows.append({
                "student": student.id,
                "student_id": student.student_id,
                "name": f"{student.first_name} {student.last_name}",
                "class_name": student.current_class.name,
                "section_name": student.current_section.name,
                "present": counts["PRESENT"],
                "absent": counts["ABSENT"],
                "late": counts["LATE"],
                "half_day": counts["HALF_DAY"],
                "total_marked": total_marked,
                "percentage": percentage,
            })

        with_data = [r["percentage"] for r in rows if r["percentage"] is not None]
        average_percentage = round(sum(with_data) / len(with_data), 2) if with_data else None

        return Response({
            "date_from": date_from,
            "date_to": date_to,
            "rows": rows,
            "summary": {"total_students": len(rows), "average_percentage": average_percentage},
        })


class MarksReportView(APIView):
    """Per-student report card for one exam: marks per subject (from
    SubjectMarksConfig), plus a total/percentage for BOARD_MARKS classes.
    CCE_GRADE classes (LKG-10) show grades only, no total."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        exam_id = request.query_params.get("exam")
        if not exam_id:
            return Response({"detail": "exam is required."}, status=400)
        try:
            exam = filter_classes_by_division(
                Exam.objects.select_related("school_class", "academic_year"), request.user, prefix="school_class__"
            ).get(pk=exam_id)
        except Exam.DoesNotExist:
            return Response({"detail": "Exam not found."}, status=404)

        assessment_config = AssessmentConfig.objects.filter(school_class=exam.school_class).first()
        mode = assessment_config.mode if assessment_config else AssessmentConfig.Mode.BOARD_MARKS

        subject_configs = list(
            SubjectMarksConfig.objects.filter(school_class=exam.school_class)
            .select_related("subject")
            .order_by("subject__name")
        )
        subjects = [
            {
                "id": sc.subject_id,
                "name": sc.subject.name,
                "max_theory": sc.max_theory,
                "max_internal": sc.max_internal,
                "max_total": sc.max_theory + sc.max_internal,
            }
            for sc in subject_configs
        ]

        students = Student.objects.select_related("current_section").filter(current_class=exam.school_class)
        section = request.query_params.get("section")
        if section:
            students = students.filter(current_section_id=section)

        entries = MarksEntry.objects.filter(exam=exam, student__in=students).select_related("subject")
        entries_by_student = {}
        for entry in entries:
            entries_by_student.setdefault(entry.student_id, {})[entry.subject_id] = entry

        rows = []
        for student in students.order_by("current_section__name", "first_name"):
            student_entries = entries_by_student.get(student.id, {})
            marks = {}
            total_obtained = 0.0
            total_max = 0

            for sc in subject_configs:
                entry = student_entries.get(sc.subject_id)
                if entry is None:
                    marks[sc.subject_id] = None
                    continue
                if mode == AssessmentConfig.Mode.BOARD_MARKS:
                    theory = float(entry.theory_marks) if entry.theory_marks is not None else None
                    internal = float(entry.internal_marks) if entry.internal_marks is not None else None
                    subject_total = None
                    if theory is not None or internal is not None:
                        subject_total = (theory or 0) + (internal or 0)
                        total_obtained += subject_total
                        total_max += sc.max_theory + sc.max_internal
                    marks[sc.subject_id] = {
                        "theory": theory,
                        "internal": internal,
                        "total": subject_total,
                        "grade": entry.grade,
                        "is_published": entry.is_published,
                    }
                else:
                    marks[sc.subject_id] = {
                        "theory": None,
                        "internal": None,
                        "total": None,
                        "grade": entry.grade,
                        "is_published": entry.is_published,
                    }

            percentage = round((total_obtained / total_max) * 100, 2) if total_max else None
            rows.append({
                "student": student.id,
                "student_id": student.student_id,
                "name": f"{student.first_name} {student.last_name}",
                "section_name": student.current_section.name,
                "marks": marks,
                "total_obtained": round(total_obtained, 2) if total_max else None,
                "total_max": total_max or None,
                "percentage": percentage,
            })

        return Response({
            "exam": {
                "id": exam.id,
                "name": exam.name,
                "term": exam.term,
                "school_class": exam.school_class.name,
                "academic_year": exam.academic_year.name,
            },
            "mode": mode,
            "subjects": subjects,
            "rows": rows,
        })


class FeeCollectionReportView(APIView):
    """Payments collected over a date range, optionally filtered to one
    section or class, with a grand total and a breakdown by payment mode."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        default_from, default_to = _month_to_date_bounds(today)
        date_from = request.query_params.get("date_from") or str(default_from)
        date_to = request.query_params.get("date_to") or str(default_to)

        payments = filter_classes_by_division(
            Payment.objects.select_related("student__current_class", "student__current_section").filter(
                date__gte=date_from, date__lte=date_to
            ),
            request.user,
            prefix="student__current_class__",
        )
        section = request.query_params.get("section")
        school_class = request.query_params.get("class")
        if section:
            payments = payments.filter(student__current_section_id=section)
        elif school_class:
            payments = payments.filter(student__current_class_id=school_class)

        rows = []
        by_mode = {mode_value: 0.0 for mode_value, _ in Payment.Mode.choices}
        total_amount = 0.0
        for payment in payments.order_by("-date"):
            amount = float(payment.amount)
            total_amount += amount
            by_mode[payment.mode] += amount
            rows.append({
                "uid": str(payment.uid),
                "date": payment.date,
                "student": payment.student_id,
                "student_id": payment.student.student_id,
                "student_name": f"{payment.student.first_name} {payment.student.last_name}",
                "class_name": payment.student.current_class.name,
                "section_name": payment.student.current_section.name,
                "amount": amount,
                "mode": payment.mode,
                "reference_number": payment.reference_number,
            })

        return Response({
            "date_from": date_from,
            "date_to": date_to,
            "rows": rows,
            "summary": {
                "count": len(rows),
                "total_amount": round(total_amount, 2),
                "by_mode": {k: round(v, 2) for k, v in by_mode.items()},
            },
        })


class EnrollmentReportView(APIView):
    """Current student headcount by class + section, with a gender breakdown
    per row and overall totals. gender is free-text on Student, so the
    breakdown keys are whatever values are actually in use."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = []
        totals_by_gender = {}
        total_students = 0

        sections = filter_classes_by_division(
            Section.objects.select_related("school_class"), request.user, prefix="school_class__"
        ).order_by("school_class__id", "name")
        for section in sections:
            gender_rows = (
                Student.objects.filter(current_section=section).values("gender").annotate(count=Count("id"))
            )
            gender_counts = {row["gender"]: row["count"] for row in gender_rows}
            count = sum(gender_counts.values())
            if count == 0:
                continue
            total_students += count
            for gender, gender_count in gender_counts.items():
                totals_by_gender[gender] = totals_by_gender.get(gender, 0) + gender_count
            rows.append({
                "class_name": section.school_class.name,
                "section_name": section.name,
                "stream": section.stream,
                "combination": section.combination,
                "total": count,
                "gender_breakdown": gender_counts,
            })

        return Response({
            "rows": rows,
            "summary": {"total_students": total_students, "by_gender": totals_by_gender},
        })
