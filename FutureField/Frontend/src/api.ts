import { supabase } from "./lib/supabase";

// ==================================================
// API CONFIGURATION
// ==================================================
const BASE = (

  import.meta.env.VITE_API_URL || "http://localhost:8000"

).replace(/\/$/, "");

// ==================================================
// AUTHENTICATION
// ==================================================
async function getAuthHeaders(

  hasBody = false

): Promise<Record<string, string>> {

  const headers: Record<string, string> = {};

  if (hasBody) {

    headers["Content-Type"] = "application/json";

  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {

    console.error("Supabase session error:", error.message);

  }

  if (data.session?.access_token) {

    headers.Authorization = `Bearer ${data.session.access_token}`;

  }

  return headers;

}

// ==================================================
// ERROR HANDLING
// ==================================================
async function parseError(

  res: Response,

  path: string

): Promise<never> {

  let detail = `${res.status} ${res.statusText}`;

  try {

    const body = await res.json();

    detail = body.detail

      ? typeof body.detail === "string"

        ? body.detail

        : JSON.stringify(body.detail)

      : JSON.stringify(body);

  } catch {

// Response does not contain a JSON error body.
  }

  throw new Error(`${path} → ${detail}`);

}

// ==================================================
// HTTP HELPERS
// ==================================================
async function get<T>(path: string): Promise<T> {

  const res = await fetch(`${BASE}${path}`, {

    method: "GET",

    headers: await getAuthHeaders(),

  });

  if (!res.ok) {

    return parseError(res, `GET ${path}`);

  }

  return res.json() as Promise<T>;

}

async function send<T>(

  method: string,

  path: string,

  body?: unknown

): Promise<T> {

  const res = await fetch(`${BASE}${path}`, {

    method,

    headers: await getAuthHeaders(body !== undefined),

    body:

      body !== undefined

        ? JSON.stringify(body)

        : undefined,

  });

  if (!res.ok) {

    return parseError(res, `${method} ${path}`);

  }

  if (res.status === 204) {

    return undefined as T;

  }

  return res.json() as Promise<T>;

}

const post = <T>(path: string, body: unknown) =>

  send<T>("POST", path, body);

const patch = <T>(path: string, body?: unknown) =>

  send<T>("PATCH", path, body);

const del = <T>(path: string) =>

  send<T>("DELETE", path);

const put = <T>(path: string, body: unknown) =>

  send<T>("PUT", path, body);

// ==================================================
// FIELD QUERY HELPER
// ==================================================
function withField(

  path: string,

  fieldId?: string | null

): string {

  if (!fieldId) return path;

  return `${path}${

    path.includes("?") ? "&" : "?"

  }field_id=${encodeURIComponent(fieldId)}`;

}

// ==================================================
// DASHBOARD TYPES
// ==================================================
export interface DashboardData {

  farm_name: string;

  greeting: string;

  active_fields: number;

  total_area_ha: number;

  soil_moisture_pct: number;

  water_stress: string;

  season: string;

  last_updated: string;

  field_intelligence: any;

  env_cards: {

    title: string;

    value: string;

    context: string;

  }[];

  fields?: any[];

}

export interface FieldsSummaryResponse {

  fields: any[];

  farm_name?: string;

}

// ==================================================
// ENVIRONMENT TYPES
// ==================================================
export interface EnvironmentalData {

  field_id: string;

  dataset: string;

  start: string;

  end: string;

  indicators: Record<string, number>;

  normalized: Record<string, number>;

  monthly: Record<string, Record<string, number>>;

  daily: Record<

    string,

    Array<string | number | null>

  >;

  quality_score: number;

  source: "real" | "partial" | "mock";

  sources: string[];

  fetched_at: string;

}

// ==================================================
// PERSONAL FIELD INTELLIGENCE
// SHARED NASA METRICS
// ==================================================
export interface PersonalFieldMetrics {

  field_id: string;

  status: "available" | "unavailable";

  source: "real" | "partial" | "mock";

  sources: string[];

  period: {

    start: string;

    end: string;

  };

  rainfall_mm: number | null;

  temperature_c: number | null;

  root_zone_wetness_pct: number | null;

  ndvi: number | null;

  water_stress: string;

  water_stress_assessment: {

    level: string;

    status: string;

    method: string;

  };

  field_health_score: number | null;

  data_quality: number | null;

  coverage: {

    expected_days: number;

    rainfall_days: number;

    temperature_days: number;

    wetness_days: number;

    ndvi_days: number;

    rainfall_complete?: boolean;

  };

}

export interface PersonalFieldIntelligenceResponse {

  field_id: string;

  field_name: string;

  metrics: PersonalFieldMetrics;

}

// ==================================================
// PERSONAL FIELD CONDITION ASSESSMENT
// NEW — SIX DIMENSIONS
// ==================================================
export type FieldConditionDimensionKey =

  | "soil_moisture"

  | "rainfall"

  | "temperature"

  | "vegetation_health"

  | "drought_resilience"

  | "water_availability";

export type FieldConditionDimensionStatus =

  | "experimental"

  | "not_assessed"

  | "available"

  | "unavailable";

export type FieldObservationSeverity =

  | "info"

  | "success"

  | "warning"

  | "danger";

export interface PersonalFieldConditionDimension {

  key: FieldConditionDimensionKey;

  name: string;

// A dimension score is null when no
// defensible assessment is available.
  score: number | null;

  status: FieldConditionDimensionStatus;

  observed_value: number | null;

  unit: string | null;

  method: string | null;

  explanation: string;

}

export interface PersonalFieldConditionObservation {

  key: string;

  title: string;

  description: string;

  severity: FieldObservationSeverity;

  icon: string;

}

export interface PersonalFieldConditionResponse {

  field_id: string;

  field_name: string;

  current_crop: string | null;

  crop_profile_found: boolean;

  source: "real" | "partial" | "mock";

  sources: string[];

  period: {

    start: string;

    end: string;

  } | null;

  data_quality: number | null;

  assessment_type: "experimental";

  assessment_status:

    | "not_assessed"

    | "partial"

    | "complete";

// Null until the overall assessment
// has a documented scoring method.
  overall_score: number | null;

  overall_label: string;

  dimensions: PersonalFieldConditionDimension[];

  observations: PersonalFieldConditionObservation[];

  disclaimer: string;

}

// ==================================================
// ROTATION TYPES
// ==================================================
export interface RotationPriorities {

  water: number;

  yield_potential: number;

  soil_health: number;

  risk: number;

}

export interface PersonalRotationStrategy {

  strategy_id?: string;

  strategy_type?: string;

  title?: string;

  crop_ids?: string[];

  crop_names?: string[];

  slot_scores?: number[];

  score?: {

    total?: number;

    suitability?: number;

    water_impact?: number;

    soil_impact?: number;

    resilience?: number;

    yield_score?: number;

    explanation?: unknown;

  };

  explanation?: unknown;

  warnings?: unknown;

  risks?: unknown;

  season_assessment?: unknown;

  [key: string]: unknown;

}

export interface PersonalRotationsResponse {

  field_id: string;

  data_source?: string;

  simulated?: boolean;

  data_quality?: number;

  current_rotation?: PersonalRotationStrategy | null;

  alternatives?: PersonalRotationStrategy[];

  [key: string]: unknown;

}

// ==================================================
// CLIMATE INSIGHTS TYPES
// ==================================================
export interface ClimateDailyData {

  dates: string[];

  tmax: Array<number | null>;

  tmin: Array<number | null>;

  rain: Array<number | null>;

  rh: Array<number | null>;

  soil_moisture: Array<number | null>;

  ndvi: Array<number | null>;

}

export interface ClimateMonthlyRow {

  month: string;

  temperature_c: number | null;

  rainfall_mm: number | null;

  rainfall_coverage_pct: number;

  temperature_coverage_pct: number;

  soil_wetness_pct: number | null;

  ndvi: number | null;

}

export interface PersonalClimateInsightsResponse {

  field_id: string;

  source: "real" | "partial" | "mock";

  dataset: string;

  status: "available" | "unavailable";

  period: {

    start: string;

    end: string;

  };

  quality_score: number;

  sources?: string[];

  summary: Record<string, number | null>;

  daily: Partial<ClimateDailyData>;

  monthly: ClimateMonthlyRow[];

  insights: Array<{

    title: string;

    description: string;

  }>;

  fetched_at?: string;

  message?: string;

}

// ==================================================
// PERSONAL REPORT TYPES
// ==================================================
export interface ReportObservationCoverage {

  expected_days: number;

  rainfall_days: number;

  temperature_days: number;

  soil_wetness_days: number;

  ndvi_days: number;

  rainfall_complete: boolean;

}

export interface PersonalReportConditions {

  soil_moisture: string;

  rainfall: string;

  temperature: string;

  ndvi: string;

  water_stress: string;

  soil_moisture_value: number | null;

  rainfall_mm: number | null;

  temperature_c: number | null;

  ndvi_value: number | null;

  observation_coverage: ReportObservationCoverage;

}

export interface ReportUncertainty {

  key: string;

  value: string;

}

export interface PersonalReportResponse {

  report_type: "seasonal_decision_report";

  report_status: "available" | "partial";

  generated_at: string;

  farm_name: string;

  field_name: string;

  field_id: string;

  area_ha: number | null;

  current_crop: string;

  location: string;

  resilience_score: number | null;

  resilience_label: string;

  conditions: PersonalReportConditions;

  rotation_scenarios: PersonalRotationStrategy[];

  rotation_status: string;

  uncertainties: ReportUncertainty[];

  data_sources: string[];

  data_quality: number | null;

  observation_period: {

    start: string;

    end: string;

  };

  observation_source: string;

  notes: string[];

}

// ==================================================
// API METHODS
// ==================================================
// ==================================================
// PERSONAL SCENARIO LAB TYPES
// ==================================================
export interface PersonalScenarioParams {

  rainfall_pct: number; // -100 to +100 (%)

  temperature_delta: number; // -10 to +10 (°C)

  water_availability: "High" | "Medium" | "Low" | number; // 0–150 (%)

  soil_recovery: "Low" | "Medium" | "High" | number; // 0–100 (%)

}

export interface PersonalScenarioStrategy {

  name: string;

  crop_ids: string[];

  crop_names: string[];

  baseline_score: number;

  scenario_score: number;

  water_demand_mm: number;

  soil_component: number;

  resilience_component: number;

  baseline_resilience_component: number;

  scenario_resilience_component: number;

}

export interface PersonalScenarioResponse {

  field_id: string;

  field_name: string;

  status: "modeled";

  method: string;

  data_source: "real";

  data_sources: string[];

  period: { start: string; end: string };

  parameters: PersonalScenarioParams;

  baseline: {

    rainfall_pct: number;

    rainfall_mm: number;

    temperature_c: number;

    root_zone_wetness_pct: number | null;

    resilience: number | null;

  };

  scenario: {

    rainfall_pct: number;

    rainfall_mm: number;

    temperature_c: number;

    water_availability: "High" | "Medium" | "Low" | number; // 0–150 (%)

    effective_water_multiplier_pct: number;

    resilience: number | null;

  };

  strategies: PersonalScenarioStrategy[];

  chart_data: Array<{

    case: "Baseline" | "Scenario";

    "Water Saver"?: number;

    "Soil Builder"?: number;

    Balanced?: number;

  }>;

  recommended_strategy: PersonalScenarioStrategy;

  explanation: string;

  limitations: string[];

}

export const api = {

  // Authenticated Personal Scenario Lab (never use demo endpoint for personal fields).

  getPersonalScenarioLab: (fieldId: string) =>

    get<PersonalScenarioResponse>(

      `/personal/fields/${encodeURIComponent(fieldId)}/scenario-lab`

    ),

  simulatePersonalScenario: (fieldId: string, params: PersonalScenarioParams) =>

    post<PersonalScenarioResponse>(

      `/personal/fields/${encodeURIComponent(fieldId)}/scenario-lab/simulate`,

      params

    ),

// ------------------------------------------------
// HEALTH
// ------------------------------------------------
  health: () =>

    get<{

      status: string;

      mock_nasa?: boolean;

    }>("/health"),

// ------------------------------------------------
// FIELDS
// ------------------------------------------------
  listFields: () =>

    get<any[]>("/fields"),

  getField: (id: string) =>

    get<any>(

      `/fields/${encodeURIComponent(id)}`

    ),

  createField: (body: unknown) =>

    post<any>("/fields", body),

  updateField: (id: string, body: unknown) =>

    put<any>(

      `/fields/${encodeURIComponent(id)}`,

      body

    ),

  deleteField: (id: string) =>

    del<unknown>(

      `/fields/${encodeURIComponent(id)}`

    ),

// ------------------------------------------------
// PERSONAL NASA ENVIRONMENT
// ------------------------------------------------
  getPersonalEnvironment: (

    fieldId: string,

    refresh = false

  ) =>

    get<EnvironmentalData>(

      `/fields/${encodeURIComponent(fieldId)}/environment?refresh=${refresh}`

    ),

// ------------------------------------------------
// LOOKUPS
// ------------------------------------------------
  getLookups: () =>

    get<any>("/api/lookups"),

// ------------------------------------------------
// DASHBOARD
// ------------------------------------------------
  getDashboard: (

    fieldId?: string | null

  ) =>

    get<DashboardData>(

      withField("/api/dashboard", fieldId)

    ),

  getFieldsSummary: () =>

    get<FieldsSummaryResponse>(

      "/api/fields-summary"

    ),

// ------------------------------------------------
// FIELD INTELLIGENCE
// ------------------------------------------------
  getFieldIntelligence: (

    fieldId?: string | null

  ) =>

    get<any>(

      withField(

        "/api/field-intelligence",

        fieldId

      )

    ),

// Authenticated personal field intelligence.
// The legacy endpoint above is for Demo Mode.
  getPersonalFieldIntelligence: (

    fieldId: string,

    refresh = false

  ) =>

    get<PersonalFieldIntelligenceResponse>(

      `/personal/fields/${encodeURIComponent(fieldId)}/intelligence?refresh=${refresh}`

    ),

// ------------------------------------------------
// PERSONAL FIELD CONDITION — NEW
// ------------------------------------------------
  getPersonalFieldCondition: (

    fieldId: string,

    refresh = false

  ) =>

    get<PersonalFieldConditionResponse>(

      `/personal/fields/${encodeURIComponent(fieldId)}/condition?refresh=${refresh}`

    ),

// ------------------------------------------------
// CROP SUITABILITY
// ------------------------------------------------
  getCropSuitability: (

    fieldId?: string | null

  ) =>

    get<any>(

      withField(

        "/api/crop-suitability",

        fieldId

      )

    ),

  scoreCrops: (

    priorities: unknown,

    fieldId?: string | null

  ) =>

    post<any>(

      withField(

        "/api/crop-suitability/score",

        fieldId

      ),

      priorities

    ),

  getPersonalCropSuitability: (

    fieldId: string,

    priorities: RotationPriorities

  ) =>

    post<any>(

      `/personal/fields/${encodeURIComponent(fieldId)}/suitability`,

      {

        priorities,

        simulation: null,

      }

    ),

// ------------------------------------------------
// ROTATION PLANNER
// ------------------------------------------------
  getRotationsMock: (

    fieldId?: string | null

  ) =>

    get<any>(

      withField(

        "/api/rotations-mock",

        fieldId

      )

    ),

  generateRotations: (

    priorities: unknown,

    fieldId?: string | null

  ) =>

    post<any>(

      withField(

        "/api/rotations-mock/generate",

        fieldId

      ),

      priorities

    ),

  getPersonalRotations: (

    fieldId: string,

    priorities: RotationPriorities

  ) =>

    post<PersonalRotationsResponse>(

      `/personal/fields/${encodeURIComponent(fieldId)}/rotations`,

      {

        priorities,

        simulation: null,

        top_n: 4,

        n_slots: 3,

        limit: 5,

      }

    ),

// ------------------------------------------------
// PERSONAL CLIMATE INSIGHTS
// ------------------------------------------------
  getPersonalClimateInsights: (

    fieldId: string,

    refresh = false

  ) =>

    get<PersonalClimateInsightsResponse>(

      `/personal/fields/${encodeURIComponent(fieldId)}/climate-insights?refresh=${refresh}`

    ),

// ------------------------------------------------
// SCENARIO LAB
// ------------------------------------------------
  getScenarioLab: (

    fieldId?: string | null

  ) =>

    get<any>(

      withField(

        "/api/scenario-lab",

        fieldId

      )

    ),

  simulateScenario: (

    params: unknown,

    fieldId?: string | null

  ) =>

    post<any>(

      withField(

        "/api/scenario-lab/simulate",

        fieldId

      ),

      params

    ),

// ------------------------------------------------
// LEGACY CLIMATE INSIGHTS
// ------------------------------------------------
  getClimateInsights: (

    fieldId?: string | null

  ) =>

    get<any>(

      withField(

        "/api/climate-insights",

        fieldId

      )

    ),

// ------------------------------------------------
// DATA EXPLORER
// ------------------------------------------------
  getDataExplorer: (

    fieldId?: string | null,

    dataset?: string

  ) =>

    get<any>(

      withField(

        `/api/data-explorer${

          dataset

            ? `?dataset=${encodeURIComponent(dataset)}`

            : ""

        }`,

        fieldId

      )

    ),

// ------------------------------------------------
// ALERTS
// ------------------------------------------------
  getAlerts: (

    fieldId?: string | null

  ) =>

    get<any>(

      withField(

        "/api/alerts",

        fieldId

      )

    ),

  markAlertRead: (id: number) =>

    patch<any>(

      `/api/alerts/${id}/read`

    ),

  markAllAlertsRead: () =>

    patch<any>(

      "/api/alerts/read-all"

    ),

  archiveAlert: (id: number) =>

    del<any>(

      `/api/alerts/${id}`

    ),

// ------------------------------------------------
// LEGACY REPORT
// ------------------------------------------------
  getReport: (

    fieldId?: string | null

  ) =>

    get<any>(

      withField(

        "/api/report",

        fieldId

      )

    ),

// ------------------------------------------------
// PERSONAL SEASONAL DECISION REPORT
// ------------------------------------------------
  getPersonalReport: (

    fieldId: string,

    refresh = false

  ) =>

    get<PersonalReportResponse>(

      `/personal/fields/${encodeURIComponent(fieldId)}/report?refresh=${refresh}`

    ),

// ------------------------------------------------
// SEASON OUTCOMES
// ------------------------------------------------
  submitSeasonOutcome: (

    body: unknown,

    fieldId?: string | null

  ) =>

    post<any>(

      withField(

        "/api/season-outcomes",

        fieldId

      ),

      body

    ),

  getSeasonOutcomes: (

    fieldId?: string | null

  ) =>

    get<any>(

      withField(

        "/api/season-outcomes",

        fieldId

      )

    ),

// ------------------------------------------------
// FEEDBACK
// ------------------------------------------------
  submitFeedback: (

    body: unknown,

    fieldId?: string | null

  ) =>

    post<any>(

      withField(

        "/api/feedback",

        fieldId

      ),

      body

    ),

// ------------------------------------------------
// AI ASSISTANT
// ------------------------------------------------
  askAssistant: (

    question: string,

    fieldId?: string | null

  ) =>

    post<any>(

      withField(

        "/api/assistant",

        fieldId

      ),

      {

        question,

        field_id: fieldId,

      }

    ),

};

export default api;