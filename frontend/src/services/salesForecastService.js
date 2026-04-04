import api from "../api/Api";

export async function fetchSalesForecast(options = {}) {
  const { months = 6, limit = 500 } = options;

  const response = await api.get("/sales-forecast", {
    params: { months, limit },
  });

  return response.data;
}
