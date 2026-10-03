import { apiClient, tokenStorage } from './client';
import type { User } from '../types';

export async function login(username: string, password: string): Promise<void> {
  const { data } = await apiClient.post<{ access: string; refresh: string }>('/auth/token/', {
    username,
    password,
  });
  tokenStorage.setTokens(data.access, data.refresh);
}

export function logout(): void {
  tokenStorage.clear();
}

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/accounts/me/');
  return data;
}

// "Forgot password" flow — both calls are unauthenticated, matching /auth/token/.
export async function requestPasswordReset(usernameOrEmail: string): Promise<{ detail: string }> {
  const { data } = await apiClient.post<{ detail: string }>('/auth/password-reset/', {
    username_or_email: usernameOrEmail,
  });
  return data;
}

export async function confirmPasswordReset(uid: string, token: string, newPassword: string): Promise<{ detail: string }> {
  const { data } = await apiClient.post<{ detail: string }>('/auth/password-reset-confirm/', {
    uid,
    token,
    new_password: newPassword,
  });
  return data;
}
