"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, ArrowRight, AlertCircle, Loader2, CreditCard, Zap, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
    const router = useRouter();
    const [apiKey, setApiKey] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await signIn("credentials", {
                apiKey,
                redirect: false,
            });

            if (res?.error) {
                setError("Accès refusé. Veuillez vérifier votre clé API.");
            } else {
                localStorage.setItem("psp_admin_key", apiKey);
                router.push("/");
                router.refresh();
            }
        } catch (err) {
            setError("Une erreur technique est survenue.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Dynamic Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse-slow" />

            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />

            <div className="w-full max-w-[1100px] grid lg:grid-cols-2 gap-8 items-center relative z-10 animate-fade-in">

                {/* Left Side: Branding & Info */}
                <div className="hidden lg:flex flex-col space-y-8 pr-12">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold tracking-wider uppercase">
                            <Zap size={14} />
                            Version 2.0 Enterprise
                        </div>
                        <h1 className="text-6xl font-extrabold tracking-tighter leading-none">
                            Studies <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">PSP</span>
                        </h1>
                        <p className="text-lg text-slate-400 max-w-md">
                            L'orchestrateur de paiements nouvelle génération. Gérez, sécurisez et optimisez vos flux financiers mondiaux.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3 text-blue-400">
                                <CreditCard size={20} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-200">Multi-PSP</h3>
                            <p className="text-xs text-slate-500">Router vos flux intelligemment.</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-3 text-indigo-400">
                                <Globe size={20} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-200">Global Reach</h3>
                            <p className="text-xs text-slate-500">Paiements locaux et internationaux.</p>
                        </div>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="flex flex-col items-center">
                    <div className="w-full max-w-md">
                        {/* Mobile Logo */}
                        <div className="lg:hidden text-center mb-10">
                            <h1 className="text-4xl font-black tracking-tight">Studies <span className="text-blue-500">PSP</span></h1>
                        </div>

                        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[32px] p-10 shadow-2xl relative overflow-hidden group">
                            {/* Inner Glow */}
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-[60px] group-hover:bg-blue-500/30 transition-colors" />

                            <div className="relative z-10">
                                <div className="mb-8">
                                    <h2 className="text-2xl font-bold mb-2">Connexion Sécurisée</h2>
                                    <p className="text-slate-400 text-sm">Entrez votre clé d'accès administrateur.</p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                            Clé API Maîtresse
                                        </label>
                                        <div className="relative group/input">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-blue-400 transition-colors">
                                                <Lock size={18} />
                                            </div>
                                            <input
                                                type="password"
                                                required
                                                autoFocus
                                                autoComplete="off"
                                                className="w-full h-14 pl-12 pr-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
                                                placeholder="admin:••••••••"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm animate-shake">
                                            <AlertCircle size={18} />
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isLoading || !apiKey}
                                        className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] shadow-lg shadow-blue-500/20"
                                    >
                                        {isLoading ? (
                                            <Loader2 size={20} className="animate-spin" />
                                        ) : (
                                            <>
                                                Accéder au Dashboard
                                                <ArrowRight size={20} />
                                            </>
                                        )}
                                    </button>
                                </form>

                                <div className="mt-10 pt-8 border-t border-slate-800 flex flex-col space-y-4">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <ShieldCheck size={14} className="text-emerald-500" />
                                        <span className="text-[11px] font-medium">Chiffrement AES-256 bits actif</span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between">
                                        <span className="text-[10px] text-blue-300 font-semibold uppercase tracking-wider">Compte de test</span>
                                        <span className="text-[10px] font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md">admin:studies:secret</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="mt-8 text-center text-[10px] text-slate-600 uppercase tracking-[0.2em] font-medium">
                            &copy; 2026 Studies Learning Platform • Tous droits réservés
                        </p>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.1); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
                .animate-pulse-slow { animation: pulse-slow 8s infinite ease-in-out; }
                .animate-shake { animation: shake 0.2s ease-in-out 2; }
            `}</style>
        </div>
    );
}
