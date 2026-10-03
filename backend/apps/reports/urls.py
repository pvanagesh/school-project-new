from django.urls import path

from .views import AttendanceReportView, EnrollmentReportView, FeeCollectionReportView, MarksReportView

urlpatterns = [
    path("attendance/", AttendanceReportView.as_view(), name="report-attendance"),
    path("marks/", MarksReportView.as_view(), name="report-marks"),
    path("fees/", FeeCollectionReportView.as_view(), name="report-fees"),
    path("enrollment/", EnrollmentReportView.as_view(), name="report-enrollment"),
]
