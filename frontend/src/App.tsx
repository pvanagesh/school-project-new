import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { DashboardLayout } from './layout/DashboardLayout';
import { navItems } from './layout/navConfig';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SuperAdminDashboardPage } from './pages/SuperAdminDashboardPage';
import { UsersRolesPage } from './pages/UsersRolesPage';
import { AcademicYearsPage } from './pages/AcademicYearsPage';
import { SchoolProfilePage } from './pages/SchoolProfilePage';
import { ClassesSectionsPage } from './pages/ClassesSectionsPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { AttendancePage } from './pages/AttendancePage';
import { ExamsPage } from './pages/ExamsPage';
import { FeesPage } from './pages/FeesPage';
import { ReportsPage } from './pages/ReportsPage';
import { StudentsPage } from './pages/StudentsPage';
import { TeachersPage } from './pages/TeachersPage';
import { TeacherPortalPage } from './pages/TeacherPortalPage';
import { TimetablePage } from './pages/TimetablePage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';

const TEACHER_ROLES = ['TEACHER', 'CLASS_TEACHER'];

function DashboardRoute() {
  const { user } = useAuth();
  if (user?.role_name && TEACHER_ROLES.includes(user.role_name)) {
    return <TeacherPortalPage />;
  }
  return <SuperAdminDashboardPage />;
}

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
      <Route
        path="/reset-password/:uid/:token"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />}
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/users" element={<UsersRolesPage />} />
          <Route path="/academic-years" element={<AcademicYearsPage />} />
          <Route path="/school-profile" element={<SchoolProfilePage />} />
          <Route path="/classes" element={<ClassesSectionsPage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/exams" element={<ExamsPage />} />
          <Route path="/fees" element={<FeesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          {navItems
            .filter(
              (item) =>
                ![
                  '/dashboard', '/users', '/academic-years', '/school-profile', '/classes', '/subjects', '/teachers',
                  '/timetable', '/students', '/attendance', '/exams', '/fees', '/reports',
                ].includes(item.path),
            )
            .map((item) => (
              <Route key={item.path} path={item.path} element={<PlaceholderPage title={item.label} />} />
            ))}
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
