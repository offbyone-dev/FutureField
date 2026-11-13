import React, {

  createContext,

  useCallback,

  useContext,

  useEffect,

  useMemo,

  useState,

} from "react";

import api from "../api";

import { useAuth } from "./AuthContext";

const SELECTED_KEY = "futurefield-selected-field";

export type FieldRow = {

  id: string;

  name: string;

  area?: string;

  area_ha?: number;

  crop?: string;

  current_crop?: string;

  condition?: string;

  moisture?: string;

  ndvi?: string;

  stress?: string;

  lastObs?: string;

  rainfall_trend?: string;

  temp_trend?: string;

  division?: string;

  district?: string;

  boundary?: any;

  centroid_lat?: number;

  centroid_lon?: number;

};

export type Lookups = {

  soil_types: {

    id: string;

    label: string;

    ph: number;

    organic_matter: number;

    drainage: string;

  }[];

  irrigation_types: {

    id: string;

    label: string;

  }[];

  water_sources: {

    id: string;

    label: string;

  }[];

  crops: {

    id: string;

    name: string;

  }[];

  farm_name?: string;

};

type PendingBoundary = {

  vertices: [number, number][];

  division: string;

  district: string;

  areaHa: number;

} | null;

type FarmContextValue = {

  fields: FieldRow[];

  selectedFieldId: string | null;

  selectedField: FieldRow | null;

  setSelectedFieldId: (id: string) => void;

  lookups: Lookups;

  farmName: string;

  lastUpdated: string;

  loading: boolean;

  refreshFields: () => Promise<void>;

  pendingBoundary: PendingBoundary;

  setPendingBoundary: (value: PendingBoundary) => void;

};

const FarmContext = createContext<FarmContextValue | null>(null);

const emptyLookups: Lookups = {

  soil_types: [],

  irrigation_types: [],

  water_sources: [],

  crops: [],

};

type FarmProviderProps = {

  children: React.ReactNode;

  preferAdd?: boolean;

  isDemo?: boolean;

};

export function FarmProvider({

  children,

  preferAdd = false,

  isDemo = false,

}: FarmProviderProps) {

  const { user } = useAuth();

  // Separate localStorage key for Demo Mode and each user.

  const storageKey = useMemo(() => {

    if (isDemo) {

      return `${SELECTED_KEY}-demo`;

    }

    return `${SELECTED_KEY}-${user?.id ?? "guest"}`;

  }, [isDemo, user?.id]);

  const [fields, setFields] = useState<FieldRow[]>([]);

  const [selectedFieldId, setSelectedFieldIdState] =

    useState<string | null>(null);

  const [lookups, setLookups] = useState<Lookups>(emptyLookups);

  const [farmName, setFarmName] = useState("FutureField Farm");

  const [lastUpdated, setLastUpdated] = useState("");

  const [loading, setLoading] = useState(true);

  const [pendingBoundary, setPendingBoundary] =

    useState<PendingBoundary>(null);

  // Convert Supabase field rows to existing frontend format.

  const normalizePersonalField = useCallback(

    (field: FieldRow): FieldRow => {

      return {

        ...field,

        area:

          field.area_ha !== undefined

            ? `${field.area_ha.toFixed(1)} ha`

            : "—",

        crop: field.current_crop || "Unspecified",

        condition: "Pending",

        moisture: "—",

        ndvi: "—",

        stress: "—",

        lastObs: "—",

        rainfall_trend: "—",

        temp_trend: "—",

      };

    },

    []

  );

  const refreshFields = useCallback(async () => {

    setLoading(true);

    try {

      // Lookups are shared agricultural reference data.

      const lookupPromise = api

        .getLookups()

        .catch(() => emptyLookups);

      let rows: FieldRow[] = [];

      let summaryFarmName = "FutureField Farm";

      if (isDemo) {

        // Demo Mode: existing JSON-backed field summary.

        const summary = await api.getFieldsSummary();

        rows = (summary.fields || []) as FieldRow[];

        summaryFarmName =

          summary.farm_name || "FutureField Demo Farm";

      } else {

        // Personal Mode: authenticated Supabase fields.

        if (!user) {

          setFields([]);

          setSelectedFieldIdState(null);

          setLastUpdated("");

          return;

        }

        const personalFields = await api.listFields();

        rows = personalFields.map(normalizePersonalField);

      }

      const lookup = (await lookupPromise) as Lookups;

      setFields(rows);

      setLookups(lookup);

      setFarmName(

        lookup.farm_name ||

          summaryFarmName

      );

      const stored = localStorage.getItem(storageKey);

      const selectedExists = rows.some(

        (field) => field.id === stored

      );

      const nextFieldId = selectedExists

        ? stored

        : preferAdd

          ? null

          : rows[0]?.id ?? null;

      setSelectedFieldIdState(nextFieldId);

      if (nextFieldId) {

        localStorage.setItem(storageKey, nextFieldId);

      } else {

        localStorage.removeItem(storageKey);

      }

      if (!nextFieldId) {

        setLastUpdated("");

      }

    } catch (error) {

      console.error("Failed to load fields:", error);

      setFields([]);

      setSelectedFieldIdState(null);

      setLastUpdated("");

      localStorage.removeItem(storageKey);

    } finally {

      setLoading(false);

    }

  }, [

    isDemo,

    user,

    storageKey,

    preferAdd,

    normalizePersonalField,

  ]);

  // Load fields when mode or user changes.

  useEffect(() => {

    void refreshFields();

  }, [refreshFields]);

  // Dashboard date currently comes from demo JSON-backed analysis.

  // Do not call it for personal fields until the NASA pipeline

  // supports authenticated Supabase field lookup.

  useEffect(() => {

    if (!selectedFieldId || !isDemo) {

      setLastUpdated("");

      return;

    }

    let cancelled = false;

    api

      .getDashboard(selectedFieldId)

      .then((data) => {

        if (!cancelled) {

          setLastUpdated(data.last_updated || "");

        }

      })

      .catch(() => {

        if (!cancelled) {

          setLastUpdated("");

        }

      });

    return () => {

      cancelled = true;

    };

  }, [selectedFieldId, isDemo]);

  const setSelectedFieldId = useCallback(

    (id: string) => {

      // Only allow selecting a field present in the current mode.

      if (!fields.some((field) => field.id === id)) {

        return;

      }

      setSelectedFieldIdState(id);

      localStorage.setItem(storageKey, id);

    },

    [fields, storageKey]

  );

  const selectedField = useMemo(

    () =>

      fields.find((field) => field.id === selectedFieldId) ||

      null,

    [fields, selectedFieldId]

  );

  const value = useMemo(

    () => ({

      fields,

      selectedFieldId,

      selectedField,

      setSelectedFieldId,

      lookups,

      farmName,

      lastUpdated,

      loading,

      refreshFields,

      pendingBoundary,

      setPendingBoundary,

    }),

    [

      fields,

      selectedFieldId,

      selectedField,

      setSelectedFieldId,

      lookups,

      farmName,

      lastUpdated,

      loading,

      refreshFields,

      pendingBoundary,

    ]

  );

  return (

    <FarmContext.Provider value={value}>

      {children}

    </FarmContext.Provider>

  );

}

export function useFarm() {

  const context = useContext(FarmContext);

  if (!context) {

    throw new Error(

      "useFarm must be used inside FarmProvider"

    );

  }

  return context;

}