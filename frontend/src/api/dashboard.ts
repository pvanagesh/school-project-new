import { apiClient } from './client';
import type { DashboardData } from '../types';

export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await apiClient.get<DashboardData>('/dashboard/');
  return data;
}
