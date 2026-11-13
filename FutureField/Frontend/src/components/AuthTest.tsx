import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthTest() {
  const [result, setResult] = useState("");

  const testAuthentication = async () => {
    setResult("Testing authentication...");

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      const token = data.session?.access_token;

      if (!token) {
        setResult("❌ No active session. Please log in first.");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/auth/me`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok && result.authenticated === true) {
        setResult("✅ JWT Verified! FastAPI recognizes your account.");
        console.log("Authentication status:", response.status);
        console.log("Authenticated user ID:", result.id);
      } else {
        setResult(
          `❌ Authentication failed (${response.status}): ${
            result.detail || "Unknown error"
          }`
        );
      }
    } catch (error) {
      console.error("Authentication test error:", error);

      setResult(
        error instanceof Error ? error.message : "Connection failed."
      );
    }
  };

  return (
    <div className="rounded-xl border border-green-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-[#174D3B]">
        FutureField Authentication Test
      </h3>

      <button
        onClick={testAuthentication}
        className="rounded-lg bg-[#174D3B] px-4 py-2 text-white"
      >
        Test Backend Authentication
      </button>

      {result && (
        <p className="mt-3 text-sm text-gray-700">{result}</p>
      )}
    </div>
  );
}