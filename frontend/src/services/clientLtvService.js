import api from "../api/Api";

export async function predictClientLtv(payload) {
  const response = await api.post("/clv/predict", payload, {
    timeout: 30000,
  });
  return response.data;
}

export async function fetchClvCustomerOptions(limit = 200) {
  const numericLimit = Number(limit);
  const safeLimit = Number.isFinite(numericLimit)
    ? Math.min(200, Math.max(1, Math.trunc(numericLimit)))
    : 200;

  const response = await api.get("/leads", {
    params: { limit: safeLimit },
    timeout: 20000,
  });

  const leads = Array.isArray(response?.data?.leads) ? response.data.leads : [];
  return leads
    .map((lead) => {
      const customerId = String(lead?.unique_id || lead?._id || "").trim();
      if (!customerId) return null;

      const name = String(lead?.name || "Unknown").trim();
      const email = String(lead?.email || "no-email").trim();

      return {
        customer_id: customerId,
        label: `${name} (${email})`,
      };
    })
    .filter(Boolean);
}
