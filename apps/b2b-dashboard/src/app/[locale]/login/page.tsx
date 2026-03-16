"use client";

import { useTranslations } from "next-intl";
import { GraduationCap, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { b2bAuth } from "@/lib/api";
import { toast } from "sonner";

export default function LoginPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await b2bAuth.login(email, password);
      const { token } = response.data.data;
      
      // Store token
      localStorage.setItem("b2b_token", token);
      
      toast.success("Connexion réussie !");
      
      // Hard refresh to clear any state and ensure interceptors are updated
      window.location.href = "/fr/dashboard";
    } catch (error: any) {
      console.error("Login error:", error);
      const message = error.response?.data?.message || "Identifiants invalides.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden selection:bg-primary/20">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl opacity-50" />
      </div>

      {/* Top-right controls */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-slide-up">
        <div className="card shadow-2xl p-8 glass-dark border-white/5">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-600 shadow-glow mb-4 transform hover:scale-105 transition-transform">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">
              Studies <span className="text-primary font-black italic">B2B</span>
            </h1>
            <p className="mt-1.5 text-sm text-text-muted">{t("loginSubtitle")}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-main pl-1">
                {t("email")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-text-muted transition-colors group-focus-within:text-primary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-11"
                  placeholder="admin@entreprise.com"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between pl-1">
                <label className="block text-sm font-medium text-text-main">
                  {t("password")}
                </label>
                <a
                  href="#"
                  className="text-xs font-medium text-primary hover:text-primary-700 transition-colors"
                >
                  {t("forgotPassword")}
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-11"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full h-12 text-base font-bold shadow-glow mt-2"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>{t("signIn") || "Se connecter"}</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-text-muted border-t border-white/5 pt-6">
            © {new Date().getFullYear()} Studies Learning. Excellence en formation B2B.
          </p>
        </div>
      </div>
    </div>
  );
}

