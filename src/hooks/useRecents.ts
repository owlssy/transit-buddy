import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRecents, saveRecent } from "@/services/storage";
import type { RecentDestination } from "@/types";

const KEY = ["recents"] as const;

export function useRecents() {
  return useQuery({
    queryKey: KEY,
    queryFn: getRecents,
    staleTime: Infinity,
  });
}

export function useSaveRecent() {
  const qc = useQueryClient();
  return async (entry: RecentDestination) => {
    await saveRecent(entry);
    await qc.invalidateQueries({ queryKey: KEY });
  };
}
