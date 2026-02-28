"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/app/admin/actions";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;

    try {
      const success = await loginAdmin(password);
      if (success) {
        // Force router refresh so the middleware sees the new cookie
        router.refresh();
        router.push("/admin");
      } else {
        setError(true);
        setPassword("");
      }
    } catch {
      setError(true);
      setPassword("");
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm p-8 bg-card border border-border rounded-xl shadow-lg">
        <h1 className="text-xl font-semibold mb-2 text-foreground text-center">
          Admin Login
        </h1>
        <p className="text-xs text-muted-foreground text-center mb-8">
          Enter the access code to manage resources.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="Code"
            autoFocus
            className={`w-full px-4 py-3 bg-background border rounded-lg text-sm text-center tracking-[0.2em] font-mono outline-none transition-colors ${
              error
                ? "border-rose-500 text-rose-500 placeholder:text-rose-500/50"
                : "border-border text-foreground hover:border-accent focus:border-accent"
            }`}
          />
          {error && (
            <p className="text-xs text-rose-500 text-center uppercase tracking-widest font-mono">
              INCORRECT CODE
            </p>
          )}
          <button
            type="submit"
            className="w-full px-4 py-3 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity mt-2 cursor-pointer border border-foreground"
          >
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
