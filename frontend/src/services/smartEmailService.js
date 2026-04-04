import api from "../api/Api";

export async function generateFollowupEmail({ unique_id, deal_stage, past_communication }) {
  const { data } = await api.post("/email/generate-followup", {
    unique_id,
    deal_stage,
    past_communication,
  }, {
    // LLM generation can exceed default 10s API timeout.
    timeout: 60000,
  });

  return data;
}
