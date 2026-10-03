# School Management System — Backend (Phase 1 scaffold)

Django + DRF + MySQL backend for a CBSE (LKG–12) school management system, Andhra Pradesh affiliation.
JWT auth, Swagger docs via drf-spectacular. Every table has a numeric `id` PK plus a public `uid` (UUID) field.

## Apps

| App | Models |
|---|---|
| `apps.core` | `SchoolProfile`, `AcademicYear` |
| `apps.accounts` | `User`, `Role`, `Permission`, `AuditLog` (custom auth user, JWT endpoints) |
| `apps.students` | `Student` |
| `apps.teachers` | `Teacher` |
| `apps.academics` | `SchoolClass`, `Section`, `Subject`, `SectionSubject`, `Timetable` |
| `apps.attendance` | `Attendance` |
| `apps.exams` | `Exam`, `AssessmentConfig`, `SubjectMarksConfig`, `MarksEntry` |
| `apps.fees` | `FeeCategory`, `FeeStructure`, `Payment` (immutable receipts), `PaymentAdjustment` |
| `apps.dashboard` | no models — `/api/dashboard/` placeholder aggregation endpoint |

## Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # then fill in your MySQL credentials
```

Create the MySQL database (name must match `DB_NAME` in `.env`):

```sql
CREATE DATABASE school_erp CHARACTER SET utf8mb4;
```

Then:

```bash
python manage.py makemigrations   # already generated and committed; re-run only after model changes
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

- Swagger UI: http://127.0.0.1:8000/api/docs/
- Admin: http://127.0.0.1:8000/admin/
- Obtain JWT: `POST /api/auth/token/` with `{"username": ..., "password": ...}`
- Refresh JWT: `POST /api/auth/token/refresh/`

## Notes / follow-up work (not built in this scaffold pass)

- Stream lock-after-first-exam-publish (with audited Admin override) — currently `Student.stream_locked` exists but isn't auto-set.
- Marks validation against `SubjectMarksConfig` max theory/internal.
- Report-card publish-lock + audit-logged Admin override on `MarksEntry`.
- Student ID auto-generation (`STU-{year}-{00001}`) — currently a plain unique `CharField`, must be set manually.
- Real dashboard aggregation per role (currently a placeholder payload).
- PDF/Excel export.
- React frontend, Docker Compose.

## Notable choices

- **PyMySQL instead of mysqlclient**: `mysqlclient` needs a C compiler and MySQL dev headers to build on Windows; `PyMySQL` is pure-Python and is shimmed as the MySQL driver in `schoolerp/__init__.py`. Swap back to `mysqlclient` for production if you prefer the C driver.
- **`uid` field**: every model inherits `apps.core.models.UIDModel`, adding a non-sequential `UUIDField` so IDs exposed over the API aren't guessable sequential integers. The numeric `id` stays as the DB primary key/FK target.
