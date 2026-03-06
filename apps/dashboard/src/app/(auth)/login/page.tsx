"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, ArrowRight, AlertCircle, Loader2, CreditCard, Zap, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2>(1);
    const [apiKey, setApiKey] = useState("");
    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [mounted, setMounted] = useState(false);
    const [maskedEmail, setMaskedEmail] = useState("");

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleInit2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
            const res = await fetch(`${apiBase}/api/admin/auth/2fa/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiKey }),
            });

            const data = await res.json();

            if (data.status === "success") {
                setStep(2);
                setMaskedEmail(data.emailMasked);
            } else {
                setError(data.message || "Erreur lors de l'initialisation du 2FA.");
            }
        } catch (err) {
            setError("Impossible de contacter le serveur de sécurité.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await signIn("credentials", {
                apiKey,
                otp,
                redirect: false,
            });

            if (res?.error) {
                setError("Code OTP incorrect ou expiré.");
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

            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />

            <div className="w-full max-w-[1100px] grid lg:grid-cols-2 gap-8 items-center relative z-10 animate-fade-in">
                {/* Left Side: Branding */}
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
                            L'orchestrateur de paiements sécurisé. Authentification forte activée.
                        </p>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="flex flex-col items-center">
                    <div className="w-full max-w-md">
                        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[32px] p-10 shadow-2xl relative overflow-hidden group">
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-[60px]" />

                            <div className="relative z-10">
                                {step === 1 ? (
                                    <>
                                        <div className="mb-8">
                                            <h2 className="text-2xl font-bold mb-2">Identification</h2>
                                            <p className="text-slate-400 text-sm">Entrez votre clé d'accès pour recevoir un OTP.</p>
                                        </div>

                                        <form onSubmit={handleInit2FA} className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Clé API Admin</label>
                                                <div className="relative group/input">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500"><Lock size={18} /></div>
                                                    <input
                                                        type="password"
                                                        required
                                                        autoFocus
                                                        className="w-full h-14 pl-12 pr-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                                        placeholder="sk_••••••••"
                                                        value={apiKey}
                                                        onChange={(e) => setApiKey(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}

                                            <button type="submit" disabled={isLoading || !apiKey} className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl font-bold flex items-center justify-center gap-2">
                                                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <>Vérifier l'identité <ArrowRight size={20} /></>}
                                            </button>
                                        </form>
                                    </>
                                ) : (
                                    <>
                                        <div className="mb-8">
                                            <h2 className="text-2xl font-bold mb-2">Vérification OTP</h2>
                                            <p className="text-slate-400 text-sm">Un code à 8 chiffres a été envoyé à <b>{maskedEmail}</b>.</p>
                                        </div>

                                        <form onSubmit={handleVerifyOTP} className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Code à 8 chiffres</label>
                                                <div className="relative group/input">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500"><ShieldCheck size={18} /></div>
                                                    <input
                                                        type="text"
                                                        required
                                                        autoFocus
                                                        maxLength={8}
                                                        className="w-full h-14 pl-12 pr-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 transition-all font-mono tracking-[0.5em] text-center text-xl"
                                                        placeholder="••••••••"
                                                        value={otp}
                                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                                    />
                                                </div>
                                            </div>

                                            {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}

                                            <button type="submit" disabled={isLoading || otp.length < 8} className="w-full h-14 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl font-bold flex items-center justify-center gap-2">
                                                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <>Confirmer et se connecter</>}
                                            </button>

                                            <button type="button" onClick={() => setStep(1)} className="w-full text-xs text-slate-500 hover:text-white transition-colors">Retour à l'identification</button>
                                        </form>
                                    </>
                                )}
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
