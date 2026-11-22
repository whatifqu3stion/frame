import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/providers/AppProvider";

export function useApprovalRequestCounts(enabled = true) {
  const { activeProfileId, profiles, isOwnerAuthorized, getManagedRequestCounts } = useApp();
  return useQuery({
    queryKey: ["managed-request-counts", activeProfileId, isOwnerAuthorized, profiles.map((profile) => profile.id).join(",")],
    queryFn: getManagedRequestCounts,
    networkMode: "always",
    enabled,
    staleTime: 0,
  });
}
