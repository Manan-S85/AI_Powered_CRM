import api from "../api/Api";

export async function predictConversionLeadScore(payload) {
  const response = await api.post("/lead-scoring/conversion/predict", payload, {
    timeout: 30000,
  });
  return response.data;
}

export async function trainConversionLeadModel(options = {}) {
  const rawLimit = Number(options?.limit ?? 5000);
  const rawMinRows = Number(options?.min_rows ?? 40);

  const limit = Number.isFinite(rawLimit) ? Math.min(50000, Math.max(50, Math.trunc(rawLimit))) : 5000;
  const min_rows = Number.isFinite(rawMinRows) ? Math.min(5000, Math.max(10, Math.trunc(rawMinRows))) : 40;

  const response = await api.post(
    "/lead-scoring/conversion/train",
    null,
    {
      params: { limit, min_rows },
      timeout: 120000,
    }
  );

  return response.data;
}
