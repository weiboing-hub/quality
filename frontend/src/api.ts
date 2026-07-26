import type {
  ComparisonRecord,
  Dashboard,
  Profile,
  ReviewDecision,
  Rule
} from "./types";

export const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `请求失败：${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getDashboard(profile: Profile) {
  return request<Dashboard>(`/dashboard?profile=${profile}`);
}

export function getRules(profile: Profile) {
  return request<Rule[]>(`/rules?profile=${profile}`);
}

export function getRecords(profile: Profile) {
  return request<ComparisonRecord[]>(`/records?profile=${profile}`);
}

export function decideReview(
  recordId: string,
  decision: "approved" | "rejected"
) {
  return request<ReviewDecision>(`/reviews/${recordId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      decision,
      note: decision === "approved" ? "确认采用清洗建议" : "保留原始值"
    })
  });
}

export function uploadCsv(content: string) {
  return request<{ count: number; message: string }>("/datasets/upload", {
    method: "POST",
    headers: { "Content-Type": "text/csv; charset=utf-8" },
    body: content
  });
}

export function resetDemo() {
  return request<{ message: string; count: number }>("/reset", {
    method: "POST"
  });
}

