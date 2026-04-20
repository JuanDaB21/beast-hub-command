import { supabase } from "@/integrations/supabase/client";
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
    queryFn: async (): Promise<StaffProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StaffProfile[];
    },
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
    mutationFn: async (input: NewStaffInput) => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: input.full_name },
        },
      });
      if (error) throw error;
      // Trigger handle_new_user creates profile automatically.
      // Update full_name explicitly in case metadata wasn't picked up.
      if (data.user?.id) {
        await supabase
          .from("profiles")
          .update({ full_name: input.full_name, email: input.email })
          .eq("id", data.user.id);
      }
      return data.user;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_STAFF }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
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
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_STAFF }),
  });
}
