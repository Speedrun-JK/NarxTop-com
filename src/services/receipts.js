import { apiFetch } from "../lib/api";

export async function uploadReceipt(payload) {
  let response;
  try {
    response = await apiFetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch { throw new Error("OFFLINE"); }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.code ?? (response.status >= 500 ? "SERVER" : "INVALID"));
  return result;
}
