"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
    ArrowLeft,
    ChevronRight,
    Plus,
    Rocket,
    ShieldCheck,
    CreditCard,
    Smartphone,
    CheckCircle2,
    AlertTriangle,
    Code2,
} from "lucide-react";

// ── Components ──────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex items-center gap-1 mb-10">
            {Array.from({ length: total }).map((_, i) => (
                <div key={i} className="flex items-center">
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300",
                        i + 1 === current ? "bg-primary text-white shadow-glow translate-y-[-2px]" :
                            i + 1 < current ? "bg-success text-white" : "bg-border text-text-light"
                    )}>
                        {i + 1 < current ? <CheckCircle2 size={16} /> : i + 1}
                    </div>
                    {i < total - 1 && (
                        <div className={cn(
                            "w-12 h-0.5 mx-1 rounded-full",
                            i + 1 < current ? "bg-success" : "bg-border"
                        )} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProviderStudioPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: "",
        code: "",
        factoryCode: "",
        isActive: true,
        supportCard: true,
        supportMobileMoney: true,
        config: "{}",
    });

    const { data: factoryCodes = [] } = useQuery({
        queryKey: ["factory-codes"],
        queryFn: () => adminApi.getFactoryCodes().then((r) => r.data.data),
    });

    const mutation = useMutation({
        mutationFn: (data: typeof formData) => {
            const parsedConfig = JSON.parse(data.config);
            return adminApi.createProvider({ ...data, config: parsedConfig });
        },
        onSuccess: () => {
            setStep(4); // Success step
        },
    });

    const nextStep = () => setStep((s) => s + 1);
    const prevStep = () => setStep((s) => s - 1);

    return (
        <div className="max-w-3xl mx-auto py-10 animate-slide-up">
            <button onClick={() => router.back()} className="btn-ghost gap-2 mb-6 -ml-2 text-text-light hover:text-text-main">
                <ArrowLeft size={16} /> Retour au Health Studio
            </button>

            <div className="flex items-start justify-between mb-2">
                <div>
                    <h1 className="text-3xl font-black text-text-main tracking-tight">
                        Provider <span className="gradient-text">Studio</span>
                    </h1>
                    <p className="text-sm text-text-light mt-1">
                        Assistant de déploiement d&apos;un nouvel agrégateur de paiement
                    </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow text-white">
                    <Plus size={24} />
                </div>
            </div>

            <div className="mt-10">
                <StepIndicator current={step} total={4} />

                {/* Step 1: Identity */}
                {step === 1 && (
                    <div className="card p-8 animate-fade-in space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <ShieldCheck className="text-primary" />
                            <h2 className="text-lg font-bold text-text-main">Identité du Provider</h2>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-text-light uppercase tracking-wider mb-1.5 block">Nom Public</label>
                                <input className="input h-12 px-4 text-base" placeholder="ex: Orange Money Cameroon"
                                    value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                <p className="text-[10px] text-text-light mt-2 italic">Le nom tel qu&apos;il apparaîtra dans les logs et le dashboard.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-light uppercase tracking-wider mb-1.5 block">Code Interne</label>
                                    <input className="input h-12 px-4 font-mono text-sm" placeholder="ex: orange_money"
                                        value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-light uppercase tracking-wider mb-1.5 block">Implementation (Factory)</label>
                                    <select className="input h-12 px-4"
                                        value={formData.factoryCode} onChange={(e) => setFormData({ ...formData, factoryCode: e.target.value })}>
                                        <option value="">Sélectionner...</option>
                                        {factoryCodes.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <button onClick={nextStep} disabled={!formData.name || !formData.code || !formData.factoryCode} className="btn-primary h-12 px-8 rounded-2xl">
                                Suivant <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Capabilities */}
                {step === 2 && (
                    <div className="card p-8 animate-fade-in space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Rocket className="text-primary" />
                            <h2 className="text-lg font-bold text-text-main">Capacités & Méthodes</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className={cn(
                                "p-6 rounded-3xl border-2 transition-all cursor-pointer group",
                                formData.supportCard ? "border-primary bg-primary-light/20" : "border-border hover:border-border-dark"
                            )} onClick={() => setFormData({ ...formData, supportCard: !formData.supportCard })}>
                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors", formData.supportCard ? "bg-primary text-white" : "bg-background text-text-light")}>
                                    <CreditCard size={24} />
                                </div>
                                <h3 className="font-bold text-text-main">Cartes Bancaires</h3>
                                <p className="text-xs text-text-light mt-1">Visa, Mastercard, etc.</p>
                            </div>
                            <div className={cn(
                                "p-6 rounded-3xl border-2 transition-all cursor-pointer group",
                                formData.supportMobileMoney ? "border-primary bg-primary-light/20" : "border-border hover:border-border-dark"
                            )} onClick={() => setFormData({ ...formData, supportMobileMoney: !formData.supportMobileMoney })}>
                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors", formData.supportMobileMoney ? "bg-primary text-white" : "bg-background text-text-light")}>
                                    <Smartphone size={24} />
                                </div>
                                <h3 className="font-bold text-text-main">Mobile Money</h3>
                                <p className="text-xs text-text-light mt-1">Orange, MTN, Wave, etc.</p>
                            </div>
                        </div>
                        <div className="pt-4 flex justify-between">
                            <button onClick={prevStep} className="btn-secondary h-12 px-8 rounded-2xl">Précédent</button>
                            <button onClick={nextStep} className="btn-primary h-12 px-8 rounded-2xl">Suivant</button>
                        </div>
                    </div>
                )}

                {/* Step 3: Technical Config */}
                {step === 3 && (
                    <div className="card p-8 animate-fade-in space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Code2 className="text-primary" />
                            <h2 className="text-lg font-bold text-text-main">Configuration Technique (JSON)</h2>
                        </div>
                        <p className="text-xs text-text-light">Saisissez les clés API et paramètres spécifiques à l&apos;implémentation choisie.</p>
                        <textarea
                            className="input h-64 p-4 font-mono text-xs whitespace-pre bg-slate-900 text-indigo-100 border-none focus:ring-2 focus:ring-primary shadow-inner rounded-2xl"
                            value={formData.config}
                            onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                        />
                        <div className="pt-4 flex justify-between gap-4">
                            <button onClick={prevStep} className="btn-secondary h-12 px-8 rounded-2xl">Précédent</button>
                            <button
                                onClick={() => mutation.mutate(formData)}
                                disabled={mutation.isPending}
                                className="btn-primary flex-1 h-12 rounded-2xl justify-center font-black uppercase tracking-widest text-sm"
                            >
                                {mutation.isPending ? "Déploiement en cours..." : "Déployer le Provider"}
                            </button>
                        </div>
                        {mutation.isError && (
                            <div className="p-4 bg-danger-light rounded-2xl flex items-center gap-3 text-danger-dark font-medium border border-danger/10">
                                <AlertTriangle size={18} />
                                <span className="text-xs">{(mutation.error as any).message}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 4: Success */}
                {step === 4 && (
                    <div className="card p-12 animate-fade-in text-center space-y-6 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-success-light text-success flex items-center justify-center animate-bounce shadow-glow-success">
                            <CheckCircle2 size={40} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-text-main tracking-tight">Provider Déployé avec Succès !</h2>
                            <p className="text-text-light mt-2 max-w-sm mx-auto">
                                {formData.name} est maintenant enregistré. Vous pouvez configurer ses routes dans le Route Builder.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 w-full max-w-xs">
                            <button onClick={() => router.push("/routing")} className="btn-primary h-12 rounded-2xl justify-center">
                                Configurer le routage
                            </button>
                            <button onClick={() => router.push("/providers")} className="btn-ghost h-12 rounded-2xl justify-center">
                                Voir dans Health Studio
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
