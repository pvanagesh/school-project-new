import { apiClient } from './client';
import type {
  FeeCategory,
  FeeCategoryFormValues,
  FeeStructure,
  FeeStructureFormValues,
  Payment,
  PaymentAdjustment,
  PaymentAdjustmentFormValues,
  PaymentFormValues,
} from '../types';

export async function fetchFeeCategories(): Promise<FeeCategory[]> {
  const { data } = await apiClient.get<FeeCategory[]>('/fees/fee-categories/');
  return data;
}

export async function createFeeCategory(payload: FeeCategoryFormValues): Promise<FeeCategory> {
  const { data } = await apiClient.post<FeeCategory>('/fees/fee-categories/', payload);
  return data;
}

export async function updateFeeCategory(id: number, payload: Partial<FeeCategoryFormValues>): Promise<FeeCategory> {
  const { data } = await apiClient.patch<FeeCategory>(`/fees/fee-categories/${id}/`, payload);
  return data;
}

export async function deleteFeeCategory(id: number): Promise<void> {
  await apiClient.delete(`/fees/fee-categories/${id}/`);
}

export async function fetchFeeStructures(): Promise<FeeStructure[]> {
  const { data } = await apiClient.get<FeeStructure[]>('/fees/fee-structures/');
  return data;
}

export async function createFeeStructure(payload: FeeStructureFormValues): Promise<FeeStructure> {
  const { data } = await apiClient.post<FeeStructure>('/fees/fee-structures/', payload);
  return data;
}

export async function updateFeeStructure(
  id: number,
  payload: Partial<FeeStructureFormValues>,
): Promise<FeeStructure> {
  const { data } = await apiClient.patch<FeeStructure>(`/fees/fee-structures/${id}/`, payload);
  return data;
}

export async function deleteFeeStructure(id: number): Promise<void> {
  await apiClient.delete(`/fees/fee-structures/${id}/`);
}

export async function fetchPayments(): Promise<Payment[]> {
  const { data } = await apiClient.get<Payment[]>('/fees/payments/');
  return data;
}

export async function createPayment(payload: PaymentFormValues): Promise<Payment> {
  const { data } = await apiClient.post<Payment>('/fees/payments/', payload);
  return data;
}

export async function fetchPaymentAdjustments(): Promise<PaymentAdjustment[]> {
  const { data } = await apiClient.get<PaymentAdjustment[]>('/fees/payment-adjustments/');
  return data;
}

export async function createPaymentAdjustment(
  payload: PaymentAdjustmentFormValues,
): Promise<PaymentAdjustment> {
  const { data } = await apiClient.post<PaymentAdjustment>('/fees/payment-adjustments/', payload);
  return data;
}

export async function deletePaymentAdjustment(id: number): Promise<void> {
  await apiClient.delete(`/fees/payment-adjustments/${id}/`);
}
