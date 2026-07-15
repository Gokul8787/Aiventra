"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/services/supabase/client";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    router.replace("/");
    router.refresh();
  }

  async function register() {
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName,
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Registration failed.");
    }

    await signIn();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage(null);

      if (mode === "register") {
        await register();
      } else {
        await signIn();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage(null);
    setConfirmPassword("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-slate-900 p-8"
      >
        <h1 className="text-3xl font-bold">
          {mode === "register" ? "Create your Aiventra account" : "Sign in to Aiventra"}
        </h1>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-800 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-lg px-4 py-2 ${
              mode === "login"
                ? "bg-cyan-600 text-white"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`rounded-lg px-4 py-2 ${
              mode === "register"
                ? "bg-cyan-600 text-white"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Register
          </button>
        </div>

        {mode === "register" && (
          <>
            <label className="mt-6 block text-sm text-slate-300">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              className="mt-2 w-full rounded-xl bg-slate-800 px-4 py-3"
            />
          </>
        )}

        <label
          className={`block text-sm text-slate-300 ${
            mode === "register" ? "mt-4" : "mt-6"
          }`}
        >
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          className="mt-2 w-full rounded-xl bg-slate-800 px-4 py-3"
        />

        <label className="mt-4 block text-sm text-slate-300">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={
            mode === "register" ? "new-password" : "current-password"
          }
          minLength={mode === "register" ? 8 : undefined}
          className="mt-2 w-full rounded-xl bg-slate-800 px-4 py-3"
        />

        {mode === "register" && (
          <>
            <label className="mt-4 block text-sm text-slate-300">
              Confirm password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              className="mt-2 w-full rounded-xl bg-slate-800 px-4 py-3"
            />
          </>
        )}

        {message && <p className="mt-4 text-sm text-red-300">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-cyan-600 px-5 py-3 font-semibold disabled:opacity-50"
        >
          {loading
            ? mode === "register"
              ? "Creating account..."
              : "Signing in..."
            : mode === "register"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>
    </main>
  );
}
