import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import SchoolIcon from '@mui/icons-material/SchoolOutlined';
import EventNoteIcon from '@mui/icons-material/EventNoteOutlined';
import GroupIcon from '@mui/icons-material/GroupOutlined';
import ClassIcon from '@mui/icons-material/ClassOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined';
import ScheduleIcon from '@mui/icons-material/ScheduleOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import CastForEducationIcon from '@mui/icons-material/CastForEducationOutlined';
import FactCheckIcon from '@mui/icons-material/FactCheckOutlined';
import GradingIcon from '@mui/icons-material/GradingOutlined';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import AssessmentIcon from '@mui/icons-material/AssessmentOutlined';
import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material';
import type { RoleName } from '../types';

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<SvgIconProps>;
  roles?: RoleName[];
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
  { label: 'School Profile', path: '/school-profile', icon: SchoolIcon, roles: ['SUPER_ADMIN'] },
  { label: 'Academic Years', path: '/academic-years', icon: EventNoteIcon, roles: ['SUPER_ADMIN'] },
  { label: 'Users & Roles', path: '/users', icon: GroupIcon, roles: ['SUPER_ADMIN'] },
  { label: 'Classes & Sections', path: '/classes', icon: ClassIcon, roles: ['SUPER_ADMIN', 'PRINCIPAL'] },
  { label: 'Subjects', path: '/subjects', icon: MenuBookIcon, roles: ['SUPER_ADMIN', 'PRINCIPAL'] },
  { label: 'Timetable', path: '/timetable', icon: ScheduleIcon, roles: ['SUPER_ADMIN', 'PRINCIPAL'] },
  { label: 'Students', path: '/students', icon: PersonIcon, roles: ['SUPER_ADMIN', 'PRINCIPAL'] },
  { label: 'Teachers', path: '/teachers', icon: CastForEducationIcon, roles: ['SUPER_ADMIN', 'PRINCIPAL'] },
  { label: 'Attendance', path: '/attendance', icon: FactCheckIcon, roles: ['SUPER_ADMIN', 'PRINCIPAL'] },
  { label: 'Exams', path: '/exams', icon: GradingIcon, roles: ['SUPER_ADMIN', 'PRINCIPAL'] },
  { label: 'Fees', path: '/fees', icon: PaymentsIcon, roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'PRINCIPAL'] },
  { label: 'Reports', path: '/reports', icon: AssessmentIcon, roles: ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT'] },
];
