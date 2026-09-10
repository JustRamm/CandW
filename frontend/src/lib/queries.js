import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}

export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet("/dashboard"), retry: false });
}

export function useAssets(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v && v !== "all"),
  ).toString();
  return useQuery({
    queryKey: ["assets", params],
    queryFn: () => apiGet(`/assets${qs ? `?${qs}` : ""}`),
    retry: false,
  });
}

export function useAsset(id) {
  return useQuery({
    queryKey: ["asset", id],
    queryFn: () => apiGet(`/assets/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useQueueList() {
  return useQuery({ queryKey: ["queue"], queryFn: () => apiGet("/queue"), retry: false });
}

export function useAssetQueue(assetId) {
  return useQuery({
    queryKey: ["queue", "asset", assetId],
    queryFn: () => apiGet(`/queue/asset/${assetId}`),
    enabled: Boolean(assetId),
    retry: false,
  });
}

export function useCampaigns(stage) {
  return useQuery({
    queryKey: ["campaigns", stage ?? "all"],
    queryFn: () => apiGet(`/campaigns${stage && stage !== "all" ? `?stage=${stage}` : ""}`),
    retry: false,
  });
}

export function useCampaign(id) {
  return useQuery({
    queryKey: ["campaign", id],
    queryFn: () => apiGet(`/campaigns/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet("/notifications"),
    retry: false,
    refetchInterval: 60_000,
  });
}

export function useAuditLog(filters = {}) {
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v && v !== "all"),
  ).toString();
  return useQuery({
    queryKey: ["audit", filters],
    queryFn: () => apiGet(`/audit${qs ? `?${qs}` : ""}`),
    retry: false,
  });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => apiGet("/admin/settings"), retry: false });
}

export function useHolidays() {
  return useQuery({ queryKey: ["holidays"], queryFn: () => apiGet("/admin/holidays"), retry: false });
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet("/admin/users"),
    enabled,
    retry: false,
  });
}

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => apiGet("/roles"), retry: false });
}

export function useBrands(q = "") {
  return useQuery({
    queryKey: ["brands", q],
    queryFn: () => apiGet(`/brands${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    retry: false,
  });
}

export function useBrand(id) {
  return useQuery({
    queryKey: ["brand", id],
    queryFn: () => apiGet(`/brands/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useAssetTypes() {
  return useQuery({ queryKey: ["asset-types"], queryFn: () => apiGet("/asset-types"), retry: false });
}
