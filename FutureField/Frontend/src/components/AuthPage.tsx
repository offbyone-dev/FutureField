import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

type AuthPageProps = {
  onBack: () => void;
};

export default function AuthPage({ onBack }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "signup") {
        if (password.length < 8) {
          throw new Error("Password must contain at least 8 characters.");
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
            },
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        setSuccess(
          "Account created! Please check your email to verify your account."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setSuccess("");
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <button
          onClick={onBack}
          className="mb-8 text-sm text-[#174D3B] hover:underline"
        >
          ← Back to FutureField
        </button>

        <div className="bg-white rounded-2xl shadow-lg border border-[#E5E5DF] p-8">

          <div className="text-center mb-8">
            <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-[#174D3B] flex items-center justify-center text-white text-2xl">
              🌱
            </div>

            <h1 className="text-3xl font-bold text-[#1B2420]">
              {mode === "login"
                ? "Welcome Back"
                : "Join FutureField"}
            </h1>

            <p className="text-[#6B746E] mt-3 text-sm">
              {mode === "login"
                ? "Sign in to manage your fields and farm plans."
                : "Create your account to start making smarter farm decisions."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Full Name
                </label>

                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Email Address
              </label>

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Password
              </label>

              <input
                type="password"
                required
                minLength={mode === "signup" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
              />
            </div>

            {error && (
              <div role="alert" className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div role="status" className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#174D3B] text-white py-3 rounded-lg font-semibold hover:bg-[#103D2D] transition disabled:opacity-60"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>
          </form>

          <div className="text-center mt-6 text-sm text-gray-600">
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}

            <button
              type="button"
              onClick={switchMode}
              className="ml-2 font-semibold text-[#174D3B] hover:underline"
            >
              {mode === "login" ? "Sign Up" : "Sign In"}
            </button>
          </div>

        </div>

        <p className="text-center mt-6 text-xs text-gray-500">
          FutureField — From Earth Observation to Better Farm Decisions
        </p>
      </div>
    </div>
  );
}