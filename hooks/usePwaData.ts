// hooks/usePwaData.ts
"use client";

import useSWR from "swr";

export function useEventsData(groupId: string | undefined | null) {
  const { data, error, mutate } = useSWR(
    groupId ? `/api/events?groupId=${groupId}` : null,
    {
      keepPreviousData: true, // Houd de events in beeld tijdens herladen
    }
  );
  return {
    events: data?.events ?? [],
    groupProfiles: data?.groupProfiles ?? {},
    isLoading: !data && !error,
    mutate,
  };
}

export function useExpensesData(groupId: string | undefined | null) {
  const { data, error, mutate } = useSWR(
    groupId ? `/api/expenses?groupId=${groupId}` : null,
    {
      keepPreviousData: true,
    }
  );
  return {
    members: data?.members ?? [],
    expenses: data?.expenses ?? [],
    isLoading: !data && !error,
    mutate,
  };
}