import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface StaffProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
}

const QK_STAFF = ["staff-profiles"] as const;

export function useStaff() {
  return useQuery({
    queryKey: QK_STAFF,
    queryFn: () => api.get<StaffProfile[]>("/staff"),
  });
}

export interface NewStaffInput {
  full_name: string;
  email: string;
  password: string;
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewStaffInput) =>
      api.post<{ id: string; full_name: string; email: string }>("/staff", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_STAFF }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      full_name,
      active,
    }: {
      id: string;
      full_name?: string;
      active?: boolean;
    }) => {
      const patch: { full_name?: string; active?: boolean } = {};
      if (full_name !== undefined) patch.full_name = full_name;
      if (active !== undefined) patch.active = active;
      return api.patch<StaffProfile>(`/staff/${id}`, patch);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_STAFF }),
  });
}
