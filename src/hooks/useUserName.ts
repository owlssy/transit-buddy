import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserName, setUserName } from "@/services/storage";

const KEY = ["user-name"] as const;

export function useUserName() {
  return useQuery({
    queryKey: KEY,
    queryFn: getUserName,
    staleTime: Infinity,
  });
}

export function useSaveUserName() {
  const qc = useQueryClient();
  return async (name: string) => {
    await setUserName(name);
    await qc.invalidateQueries({ queryKey: KEY });
  };
}
