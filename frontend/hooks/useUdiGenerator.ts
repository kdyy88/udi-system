import { useState } from "react";

import { api } from "@/lib/api";
import type { HealthResponse } from "@/types/udi";

export function useUdiGenerator() {
  const [loading, setLoading] = useState(false);

  const pingBackend = async (): Promise<HealthResponse> => {
    setLoading(true);
    try {
      const { data } = await api.get<HealthResponse>("/api/v1/health");
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { loading, pingBackend };
}
