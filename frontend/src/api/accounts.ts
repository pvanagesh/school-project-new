import { apiClient } from './client';
import type { Role, RoleFormValues, User, UserFormValues } from '../types';

export async function fetchUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/accounts/users/');
  return data;
}

export async function createUser(payload: UserFormValues): Promise<User> {
  const { data } = await apiClient.post<User>('/accounts/users/', payload);
  return data;
}

export async function updateUser(id: number, payload: Partial<UserFormValues>): Promise<User> {
  const { data } = await apiClient.patch<User>(`/accounts/users/${id}/`, payload);
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/accounts/users/${id}/`);
}

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<Role[]>('/accounts/roles/');
  return data;
}

export async function createRole(payload: RoleFormValues): Promise<Role> {
  const { data } = await apiClient.post<Role>('/accounts/roles/', payload);
  return data;
}

export async function updateRole(id: number, payload: Partial<RoleFormValues>): Promise<Role> {
  const { data } = await apiClient.patch<Role>(`/accounts/roles/${id}/`, payload);
  return data;
}

export async function deleteRole(id: number): Promise<void> {
  await apiClient.delete(`/accounts/roles/${id}/`);
}
