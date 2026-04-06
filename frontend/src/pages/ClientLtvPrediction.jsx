import { createElement, useEffect, useState } from "react";
import { Activity, CalendarClock, Coins, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { fetchClvCustomerOptions, predictClientLtv } from "../services/clientLtvService";

const INDUSTRY_OPTIONS = [
  "saas",
  "technology",
  "finance",
  "healthcare",
  "ecommerce",
  "manufacturing",
  "retail",
  "education",
  "other",
];

const ENGAGEMENT_OPTIONS = ["low", "medium", "high", "very_high"];

const initialForm = {
  customer_id: "",
  industry_type: "saas",
  engagement_level: "medium",
  recency_days: "30",
  orders_last_12_months: "12",
  avg_order_value: "1200",
  unique_products_purchased: "8",
  customer_lifetime_days: "365",
  avg_days_between_orders: "25",
  items_per_order: "3",
  total_spend_last_12_months: "",
};

const parseNumber = (value) => (value === "" ? null : Number(value));

const toCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function ClientLtvPrediction() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerLoadError, setCustomerLoadError] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const loadCustomerOptions = async () => {
    try {
      setLoadingCustomers(true);
      setCustomerLoadError("");
      const options = await fetchClvCustomerOptions(200);
      setCustomerOptions(options);
      if (!options.length) {
        setCustomerLoadError("No customers found in CRM leads yet. Add leads first or use sample test data.");
      }
    } catch (loadError) {
      setCustomerOptions([]);
      setCustomerLoadError(loadError?.message || "Failed to load customers from /leads endpoint.");
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    loadCustomerOptions();
  }, []);

  const useSampleData = () => {
    setForm({
      customer_id: "TEST-CUSTOMER-001",
      industry_type: "saas",
      engagement_level: "high",
      recency_days: "15",
      orders_last_12_months: "20",
      avg_order_value: "1600",
      unique_products_purchased: "12",
      customer_lifetime_days: "540",
      avg_days_between_orders: "18",
      items_per_order: "3",
      total_spend_last_12_months: "38000",
    });
    setError("");
  };

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        customer_id: form.customer_id.trim(),
        industry_type: form.industry_type,
        engagement_level: form.engagement_level,
        purchase_behavior: {
          recency_days: Number(form.recency_days),
          orders_last_12_months: Number(form.orders_last_12_months),
          avg_order_value: Number(form.avg_order_value),
          unique_products_purchased: Number(form.unique_products_purchased),
          customer_lifetime_days: Number(form.customer_lifetime_days),
          avg_days_between_orders: Number(form.avg_days_between_orders),
          items_per_order: Number(form.items_per_order),
          total_spend_last_12_months: parseNumber(form.total_spend_last_12_months),
        },
      };

      const response = await predictClientLtv(payload);
      if (!response?.success) {
        throw new Error("CLV prediction failed");
      }

      setResult(response);
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || requestError?.message || "Failed to predict CLV");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_36%),radial-gradient(circle_at_90%_0%,_rgba(34,211,238,0.14),_transparent_38%),linear-gradient(180deg,_#020617_0%,_#0f172a_50%,_#030712_100%)] px-6 md:px-10 py-8 md:py-10 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 md:mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-200 mb-4">
            <Sparkles size={14} />
            Revenue Expansion Intelligence
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-emerald-200 via-cyan-200 to-sky-200 bg-clip-text text-transparent">
            Client Lifetime Value Prediction
          </h1>
          <p className="text-slate-300 mt-3 text-base md:text-lg">
            Predict upsell opportunity and cross-sell timing from past purchase behavior, industry type, and engagement level.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.12fr_0.88fr] gap-8">
          <section className="rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur-xl p-6 md:p-7 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)]">
            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Select Existing Customer</label>
                <select
                  value={form.customer_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, customer_id: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 text-sm"
                >
                  <option value="">
                    {loadingCustomers ? "Loading customers..." : "Choose from CRM leads (uses unique ID)"}
                  </option>
                  {customerOptions.map((item) => (
                    <option key={item.customer_id} value={item.customer_id}>
                      {item.label} - {item.customer_id}
                    </option>
                  ))}
                </select>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-slate-400">
                    {loadingCustomers
                      ? "Loading customers..."
                      : `${customerOptions.length} customer${customerOptions.length === 1 ? "" : "s"} loaded`}
                  </span>
                  <button
                    type="button"
                    onClick={loadCustomerOptions}
                    className="rounded-md border border-slate-600 px-2.5 py-1 text-slate-300 hover:bg-slate-800"
                  >
                    Refresh customers
                  </button>
                  <button
                    type="button"
                    onClick={useSampleData}
                    className="rounded-md border border-emerald-500/50 px-2.5 py-1 text-emerald-300 hover:bg-emerald-500/10"
                  >
                    Use sample test data
                  </button>
                </div>

                {customerLoadError ? (
                  <p className="mt-2 text-xs text-amber-300">{customerLoadError}</p>
                ) : null}
              </div>

              <Field label="Customer ID" name="customer_id" value={form.customer_id} onChange={onChange} required />

              <p className="md:col-span-2 text-xs text-slate-400 -mt-2">
                Customer ID is the lead unique ID already stored in CRM.
              </p>

              <SelectField label="Industry Type" name="industry_type" value={form.industry_type} onChange={onChange} options={INDUSTRY_OPTIONS} />

              <SelectField label="Engagement Level" name="engagement_level" value={form.engagement_level} onChange={onChange} options={ENGAGEMENT_OPTIONS} />

              <NumberField label="Recency (days)" name="recency_days" value={form.recency_days} onChange={onChange} min="0" required />
              <NumberField label="Orders (last 12 months)" name="orders_last_12_months" value={form.orders_last_12_months} onChange={onChange} min="0" required />
              <NumberField label="Average Order Value" name="avg_order_value" value={form.avg_order_value} onChange={onChange} min="1" required />
              <NumberField label="Unique Products Purchased" name="unique_products_purchased" value={form.unique_products_purchased} onChange={onChange} min="1" required />
              <NumberField label="Customer Lifetime (days)" name="customer_lifetime_days" value={form.customer_lifetime_days} onChange={onChange} min="30" required />
              <NumberField label="Avg Days Between Orders" name="avg_days_between_orders" value={form.avg_days_between_orders} onChange={onChange} min="0" required />
              <NumberField label="Items Per Order" name="items_per_order" value={form.items_per_order} onChange={onChange} min="1" required />
              <NumberField
                label="Total Spend Last 12 Months (optional)"
                name="total_spend_last_12_months"
                value={form.total_spend_last_12_months}
                onChange={onChange}
                min="0"
              />

              {error ? <div className="md:col-span-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-3 text-sm font-semibold hover:from-emerald-500 hover:to-cyan-500 transition disabled:opacity-70"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loading ? "Predicting..." : "Predict CLV"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur-xl p-6 md:p-7 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)]">
            <h2 className="text-lg font-semibold text-slate-100 mb-5">Prediction Result</h2>

            {result ? (
              <div className="space-y-4">
                <ResultCard icon={Coins} label="Predicted CLV" value={toCurrency(result.predicted_clv)} tone="text-emerald-300" />
                <ResultCard icon={TrendingUp} label="Upsell Opportunity" value={result.upsell_opportunity} tone="text-cyan-300" />
                <ResultCard
                  icon={CalendarClock}
                  label="Cross-sell Timing"
                  value={`${result.cross_sell_timing?.recommended_in_days} days (${result.cross_sell_timing?.window})`}
                  tone="text-violet-300"
                />
                <ResultCard icon={Activity} label="Model / Confidence" value={`${result.model_used} / ${(Number(result.confidence) * 100).toFixed(0)}%`} tone="text-amber-300" />

                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Explanation</p>
                  <ul className="text-sm text-slate-200 space-y-1.5 list-disc pl-5">
                    {(result.explanation || []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
                Enter customer purchase behavior, industry, and engagement inputs to get CLV, upsell opportunity, and cross-sell timing.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, required }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-slate-400">{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 text-sm"
      />
    </div>
  );
}

function NumberField({ label, name, value, onChange, min, required }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-slate-400">{label}</label>
      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        min={min}
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 text-sm"
      />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-slate-400">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace("_", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

function ResultCard({ icon, label, value, tone }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400 inline-flex items-center gap-2">
        {icon ? createElement(icon, { size: 14 }) : null}
        {label}
      </p>
      <p className={`mt-2 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
