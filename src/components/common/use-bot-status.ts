"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BotStatus } from "@/lib/types";

/**
 * Shared hook that polls /api/bot/status and returns a profile → BotStatus map.
 */
export function useBotStatusMap() {
  const { data } = useQuery({
    queryKey: ["bot-status"],
    queryFn: () => api.getBotStatus(),
    refetchInterval: 4000,
  });
  const botStatus = React.useMemo(() => data?.bots ?? ({} as Record<string, BotStatus>), [data]);
  return { botStatus, data };
}
