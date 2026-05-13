import { createMiddleware, createStart } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const supabaseAuthHeaders = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return next(
    token
      ? {
          headers: { Authorization: `Bearer ${token}` },
        }
      : undefined,
  );
});

export const startInstance = createStart(() => ({
  functionMiddleware: [supabaseAuthHeaders],
}));