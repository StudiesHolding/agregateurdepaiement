"use client";

import { useTranslations } from "next-intl";
import { GraduationCap, Lock, ArrowRight, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { b2bAuth } from "@/lib/api";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

function ActivateContent() {
    const t = useTranslations("auth");
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">("idle");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!token || !email) {
            setStatus("error");
            setMessage("Lien d'activation invalide. Veuillez vérifier votre email.");
        }
    }, [token, email]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error("Les mots de passe ne correspondent pas");
            return;
        }

        if (password.length < 8) {
            toast.error("Le mot de passe doit contenir au moins 8 caractères");
            return;
        }

        setLoading(true);

        try {
            const response = await b2bAuth.activate(token!, email!, password);

            setStatus("success");
            setMessage("Votre compte a été activé avec succès!");

            toast.success("Compte activé! Vous pouvez maintenant vous connecter.");

            // Redirect to login after 3 seconds
            setTimeout(() => {
                window.location.href = `/fr/login?activated=true`;
            }, 3000);
        } catch (error: any) {
            console.error("Activation error:", error);
            const errorMessage = error.response?.data?.message || "Erreur lors de l'activation du compte";
            setStatus("error");
            setMessage(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (status === "success") {
        return (
            <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden selection:bg-primary/20">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
                </div>

                <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
                    <LanguageSwitcher />
                    <ThemeToggle />
                </div>

                <div className="relative z-10 w-full max-w-md mx-4">
                    <div className="card shadow-2xl p-8 glass-dark border-white/5 text-center">
                        <div className="flex flex-col items-center mb-6">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-glow mb-4">
                                <CheckCircle className="h-8 w-8 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-text-main tracking-tight">
                                Compte Activé
                            </h1>
                            <p className="mt-2 text-green-600 font-medium">{message}</p>
                        </div>

                        <p className="text-sm text-text-muted mb-6">
                            Redirection vers la page de connexion...
                        </p>

                        <a
                            href={`/fr/login?activated=true`}
                            className="btn btn-primary w-full h-12 text-base font-bold shadow-glow"
                        >
                            Se connecter
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (status === "error" && !token) {
        return (
            <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden selection:bg-primary/20">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
                </div>

                <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
                    <LanguageSwitcher />
                    <ThemeToggle />
                </div>

                <div className="relative z-10 w-full max-w-md mx-4">
                    <div className="card shadow-2xl p-8 glass-dark border-white/5 text-center">
                        <div className="flex flex-col items-center mb-6">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-600 shadow-glow mb-4">
                                <XCircle className="h-8 w-8 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-text-main tracking-tight">
                                Lien Invalide
                            </h1>
                            <p className="mt-2 text-red-600 font-medium">{message}</p>
                        </div>

                        <a
                            href="/fr/login"
                            className="btn btn-primary w-full h-12 text-base font-bold shadow-glow"
                        >
                            Retour à la connexion
                        </a>
                    </div>
                </div>
            </div>
        );
    }

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

            {/* Activation Card */}
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
                        <p className="mt-1.5 text-sm text-text-muted">Définissez votre mot de passe</p>
                    </div>

                    {/* Email display */}
                    <div className="bg-primary/5 rounded-lg p-3 mb-6 text-center">
                        <p className="text-sm text-text-muted">Activation pour</p>
                        <p className="font-medium text-text-main">{email}</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-text-main pl-1">
                                Mot de passe
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-text-muted transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input pl-11"
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                    disabled={loading}
                                />
                            </div>
                            <p className="text-xs text-text-muted pl-1">Minimum 8 caractères</p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-text-main pl-1">
                                Confirmer le mot de passe
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-text-muted transition-colors" />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="input pl-11"
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !token}
                            className="btn btn-primary w-full h-12 text-base font-bold shadow-glow mt-2"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Activer mon compte</span>
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

export default function ActivatePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <ActivateContent />
        </Suspense>
    );
}
