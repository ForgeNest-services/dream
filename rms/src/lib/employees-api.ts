import { apiClient } from "./api-client";

export interface EmployeeDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  designation: string;
  phone: string;
  email: string | null;
  salary: string; // Decimal serializes as string
  shift: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeePayload {
  name: string;
  designation?: string;
  phone?: string;
  email?: string | null;
  salary?: number;
  shift?: string | null;
}

export interface UpdateEmployeePayload {
  name?: string;
  designation?: string;
  phone?: string;
  email?: string | null;
  salary?: number;
  shift?: string | null;
  is_active?: boolean;
  clear_email?: boolean;
  clear_shift?: boolean;
}

export const employeesApi = {
  list(branchId: string) {
    return apiClient.get<EmployeeDto[]>(`/restro/branches/${branchId}/employees`);
  },
  create(branchId: string, payload: CreateEmployeePayload) {
    return apiClient.post<EmployeeDto>(`/restro/branches/${branchId}/employees`, payload);
  },
  update(branchId: string, employeeId: string, payload: UpdateEmployeePayload) {
    return apiClient.patch<EmployeeDto>(
      `/restro/branches/${branchId}/employees/${employeeId}`,
      payload,
    );
  },
  remove(branchId: string, employeeId: string) {
    return apiClient.delete<{ deleted: boolean }>(
      `/restro/branches/${branchId}/employees/${employeeId}`,
    );
  },
};
