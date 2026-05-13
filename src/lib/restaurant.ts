import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRestaurantId() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", u.user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (data && data.length > 0) {
        setRestaurantId(data[0].id);
        setLoading(false);
        return;
      }
      // Fallback: user might be staff in another restaurant
      const { data: roles } = await supabase
        .from("user_roles")
        .select("restaurant_id")
        .eq("user_id", u.user.id)
        .limit(1);
      setRestaurantId(roles?.[0]?.restaurant_id ?? null);
      setLoading(false);
    })();
  }, []);

  return { restaurantId, loading };
}

export function formatDZD(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!isFinite(n)) return "0 دج";
  return `${n.toLocaleString("en-US")} دج`;
}