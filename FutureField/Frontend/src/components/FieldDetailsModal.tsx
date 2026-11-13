import React, { useMemo, useState } from "react";
import {
  FileText,
  Mountain,
  Sprout,
  History,
  Droplets,
  Waves,
  X,
} from "lucide-react";

import { useFarm } from "../context/FarmContext";
import api from "../api";
import { verticesToGeoJSON } from "../lib/geo";

type CropHistoryRecord = {
  crop_id: string;
  year: string;
  start_month: string;
  end_month: string;
  yield_t_ha: string;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function FieldDetailsModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const {
    lookups,
    pendingBoundary,
    setPendingBoundary,
    setSelectedFieldId,
    refreshFields,
  } = useFarm();

  const [name, setName] = useState("");
  const [soilId, setSoilId] = useState("");
  const [currentCrop, setCurrentCrop] = useState("");

  const [cropHistory, setCropHistory] = useState<
    CropHistoryRecord[]
  >([]);

  const [irrigation, setIrrigation] = useState("");
  const [waterSource, setWaterSource] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const soil = useMemo(
    () => lookups.soil_types.find((s) => s.id === soilId),
    [lookups, soilId]
  );

  if (!open) return null;

  // --------------------------------------------------
  // Reset Form
  // --------------------------------------------------

  const resetForm = () => {
    setName("");
    setSoilId("");
    setCurrentCrop("");
    setCropHistory([]);
    setIrrigation("");
    setWaterSource("");
    setError("");
  };

  // --------------------------------------------------
  // Crop History Helpers
  // --------------------------------------------------

  const addCropHistory = () => {
    setCropHistory((prev) => [
      ...prev,
      {
        crop_id: "",
        year: String(new Date().getFullYear()),
        start_month: "",
        end_month: "",
        yield_t_ha: "",
      },
    ]);
  };

  const updateCropHistory = (
    index: number,
    field: keyof CropHistoryRecord,
    value: string
  ) => {
    setCropHistory((prev) =>
      prev.map((record, i) =>
        i === index
          ? {
              ...record,
              [field]: value,
            }
          : record
      )
    );
  };

  const removeCropHistory = (index: number) => {
    setCropHistory((prev) =>
      prev.filter((_, i) => i !== index)
    );
  };

  // --------------------------------------------------
  // Save Field
  // --------------------------------------------------

  const save = async () => {
    if (!pendingBoundary || pendingBoundary.vertices.length < 3) {
      setError("Draw a field boundary on the map first.");
      return;
    }

    if (!name.trim()) {
      setError("Please give your field a name.");
      return;
    }

    const currentYear = new Date().getFullYear();

    for (const [index, item] of cropHistory.entries()) {
      const year = Number(item.year);

      const yieldValue =
        item.yield_t_ha.trim() === ""
          ? null
          : Number(item.yield_t_ha);

      if (!item.crop_id) {
        setError(
          `Crop history record ${index + 1}: select a crop.`
        );
        return;
      }

      if (
        !/^\d{4}$/.test(item.year) ||
        year < 1900 ||
        year > currentYear
      ) {
        setError(
          `Crop history record ${index + 1}: enter a valid year.`
        );
        return;
      }

      if (!item.start_month || !item.end_month) {
        setError(
          `Crop history record ${index + 1}: select start and end months.`
        );
        return;
      }

      if (
        yieldValue !== null &&
        (!Number.isFinite(yieldValue) || yieldValue < 0)
      ) {
        setError(
          `Crop history record ${index + 1}: yield must be non-negative.`
        );
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      const created: any = await api.createField({
        name: name.trim(),

        boundary: verticesToGeoJSON(
          pendingBoundary.vertices
        ),

        irrigation_type: irrigation || "rainfed",

        water_source: waterSource || "rain",

        soil: {
          texture: soilId || "loam",
          ph: soil?.ph ?? 6.5,
          organic_matter: soil?.organic_matter ?? 2.0,
          drainage: soil?.drainage ?? "moderate",
          source: "farmer",
          confidence: 0.8,
        },

        // Farmer-reported historical crop records
        crop_history: cropHistory.map((item) => ({
          crop_id: item.crop_id,

          // Kept for backend compatibility
          season: "",

          year: Number(item.year),

          start_month: Number(item.start_month),

          end_month: Number(item.end_month),

          yield_t_ha:
            item.yield_t_ha.trim() === ""
              ? null
              : Number(item.yield_t_ha),
        })),

        division: pendingBoundary.division,
        district: pendingBoundary.district,

        current_crop: currentCrop,

        // Retained for compatibility with existing backend
        previous_crops: [],
        existing_rotation: [],
      });

      setPendingBoundary(null);

      await refreshFields();

      if (created?.id) {
        setSelectedFieldId(created.id);
        onSaved(created.id);
      }

      resetForm();
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          "Could not save the field. Check that the boundary is in Bangladesh."
      );
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // Reusable Form Row
  // --------------------------------------------------

  const row = (
    icon: React.ReactNode,
    title: string,
    hint: string,
    control: React.ReactNode
  ) => (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.15fr] gap-4 items-center py-4 border-b border-[#eceae4] last:border-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-[#1e4533]">
          {icon}
        </div>

        <div>
          <div className="font-semibold text-[#1c211d]">
            {title}
          </div>

          <div className="text-sm text-[#6b716c]">
            {hint}
          </div>
        </div>
      </div>

      <div>{control}</div>
    </div>
  );

  const selectClass =
    "w-full rounded-lg border border-[#e0ddd6] bg-[#fbfaf7] px-3 py-2.5 text-sm text-[#1c211d] outline-none focus:border-[#1e4533]";

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-[720px] max-h-[90vh] flex flex-col bg-[#fbfaf7] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}

        <div className="flex items-start justify-between p-6 pb-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#e8f0ea] flex items-center justify-center text-[#1e4533]">
              <Sprout className="w-5 h-5" />
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold text-[#1e4533]">
                Field Details
              </h2>

              <p className="text-sm text-[#6b716c]">
                Add information about your field to get better recommendations.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#6b716c] hover:text-[#1c211d] p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}

        <div className="px-6 py-2 overflow-y-auto min-h-0 flex-1">

          {pendingBoundary && (
            <p className="text-xs text-[#6b716c] mb-2">
              {pendingBoundary.district ||
                pendingBoundary.division ||
                "Bangladesh"}{" "}
              · {pendingBoundary.areaHa.toFixed(2)} ha drawn
            </p>
          )}

          {/* Field Name */}

          {row(
            <FileText className="w-5 h-5" />,
            "Field Name",
            "Give a name to identify your field.",
            <input
              className={selectClass}
              placeholder="e.g., North Field, My Rice Field"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          {/* Soil Type */}

          {row(
            <Mountain className="w-5 h-5" />,
            "Soil Type",
            "Select the main soil type of your field.",
            <select
              className={selectClass}
              value={soilId}
              onChange={(e) => setSoilId(e.target.value)}
            >
              <option value="">Select soil type</option>

              {lookups.soil_types.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}

          {/* Current Crop */}

          {row(
            <Sprout className="w-5 h-5" />,
            "Current Crop",
            "What crop is currently planted?",
            <select
              className={selectClass}
              value={currentCrop}
              onChange={(e) => setCurrentCrop(e.target.value)}
            >
              <option value="">Select current crop</option>

              {lookups.crops.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Crop History */}

          {row(
            <History className="w-5 h-5" />,
            "Crop History",
            "Record crops grown previously, including their cultivation months.",
            <div className="space-y-3">

              {cropHistory.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-[#e0ddd6] bg-white p-3 space-y-3"
                >

                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Record {index + 1}</span>

                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() =>
                        removeCropHistory(index)
                      }
                    >
                      Remove
                    </button>
                  </div>

                  {/* Crop */}

                  <select
                    className={selectClass}
                    value={item.crop_id}
                    onChange={(e) =>
                      updateCropHistory(
                        index,
                        "crop_id",
                        e.target.value
                      )
                    }
                  >
                    <option value="">Select crop</option>

                    {lookups.crops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Start Month / End Month */}

                  <div className="grid grid-cols-2 gap-2">

                    <label className="text-xs">
                      Start Month

                      <select
                        className={selectClass}
                        value={item.start_month}
                        onChange={(e) =>
                          updateCropHistory(
                            index,
                            "start_month",
                            e.target.value
                          )
                        }
                      >
                        <option value="">
                          Select month
                        </option>

                        {MONTHS.map((month, i) => (
                          <option
                            key={month}
                            value={i + 1}
                          >
                            {month}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs">
                      End Month

                      <select
                        className={selectClass}
                        value={item.end_month}
                        onChange={(e) =>
                          updateCropHistory(
                            index,
                            "end_month",
                            e.target.value
                          )
                        }
                      >
                        <option value="">
                          Select month
                        </option>

                        {MONTHS.map((month, i) => (
                          <option
                            key={month}
                            value={i + 1}
                          >
                            {month}
                          </option>
                        ))}
                      </select>
                    </label>

                  </div>

                  {/* Year */}

                  <label className="text-xs">
                    Year

                    <input
                      className={selectClass}
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={item.year}
                      onChange={(e) =>
                        updateCropHistory(
                          index,
                          "year",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  {/* Yield */}

                  <label className="text-xs">
                    Yield (t/ha, optional)

                    <input
                      className={selectClass}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Optional"
                      value={item.yield_t_ha}
                      onChange={(e) =>
                        updateCropHistory(
                          index,
                          "yield_t_ha",
                          e.target.value
                        )
                      }
                    />
                  </label>

                </div>
              ))}

              <button
                type="button"
                className="rounded-lg bg-[#1e4533] px-3 py-2 text-sm font-semibold text-white"
                onClick={addCropHistory}
              >
                + Add Crop
              </button>

            </div>
          )}

          {/* Irrigation Type */}

          {row(
            <Droplets className="w-5 h-5" />,
            "Irrigation Type",
            "How do you irrigate your field?",
            <select
              className={selectClass}
              value={irrigation}
              onChange={(e) => setIrrigation(e.target.value)}
            >
              <option value="">
                Select irrigation type
              </option>

              {lookups.irrigation_types.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}

          {/* Water Source */}

          {row(
            <Waves className="w-5 h-5" />,
            "Water Source",
            "Where does your irrigation water come from?",
            <select
              className={selectClass}
              value={waterSource}
              onChange={(e) => setWaterSource(e.target.value)}
            >
              <option value="">
                Select water source
              </option>

              {lookups.water_sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}

          {error && (
            <p
              role="alert"
              className="text-sm text-red-600 py-2"
            >
              {error}
            </p>
          )}

        </div>

        {/* Footer */}

        <div className="px-6 py-5 flex gap-3 shrink-0 border-t border-[#eceae4]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#d7d3cb] bg-white py-3 font-semibold text-[#1e4533]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-lg bg-[#1e4533] text-white py-3 font-semibold hover:bg-[#163628] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Field"}
          </button>
        </div>

      </div>
    </div>
  );
}