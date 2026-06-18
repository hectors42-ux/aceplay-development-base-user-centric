import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnalyticsAlert {
  kind: "critical" | "opportunity";
  severity: "high" | "medium" | "low";
  title: string;
  body: string;
  action_url: string | null;
  metric_value: number | null;
}

export function useAnalyticsAlerts() {
  return useQuery({
    queryKey: ["analytics", "alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analytics_alerts");
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsAlert[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
