import api from "../api/Api";

export async function runLeadGenerationQuery(query, options = {}) {
  const payload = {
    query: String(query || "").trim(),
    max_results: Number(options?.max_results ?? 10),
    persist: options?.persist !== false,
  };

  const response = await api.post("/lead-generation/search-query", payload, {
    timeout: 30000,
  });

  return response.data;
}

export async function getLeadGenerationDashboard(options = {}) {
  const params = {
    limit: Number(options?.limit ?? 100),
  };

  if (options?.category) {
    params.category = String(options.category).toUpperCase();
  }

  const response = await api.get("/lead-generation/dashboard", {
    params,
    timeout: 30000,
  });

  return response.data;
}
