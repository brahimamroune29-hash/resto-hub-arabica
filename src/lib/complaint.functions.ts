import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GENERIC_ERR = "حدث خطأ، يرجى المحاولة لاحقاً";

const SubmitComplaintSchema = z.object({
  qr_token: z.string().min(8).max(128),
  type: z.string().trim().min(1).max(50),
  description: z.string().trim().min(1).max(2000),
  customer_name: z.string().trim().max(120).optional().nullable(),
  customer_phone: z.string().trim().max(40).optional().nullable(),
});

export const submitComplaint = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SubmitComplaintSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: table, error: tErr } = await supabaseAdmin
      .from("tables")
      .select("restaurant_id")
      .eq("qr_token", data.qr_token)
      .maybeSingle();
    if (tErr) {
      console.error("[submitComplaint] tables lookup error", tErr);
      throw new Error(GENERIC_ERR);
    }
    if (!table) throw new Error("NOT_FOUND");

    const { error } = await supabaseAdmin.from("complaints").insert({
      restaurant_id: table.restaurant_id,
      type: data.type,
      description: data.description,
      customer_name: data.customer_name?.trim() || null,
      customer_phone: data.customer_phone?.trim() || null,
    });
    if (error) {
      console.error("[submitComplaint] insert error", error);
      throw new Error(GENERIC_ERR);
    }
    return { ok: true };
  });