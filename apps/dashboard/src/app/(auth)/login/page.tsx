"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowUpRight, Fingerprint, Lock, ShieldAlert, ShieldCheck } from "lucide-react";

/**
 * Connexion à l'administration du PSP (ADR-0018, D5.2)
 * Une seule porte : l'administration Studies Learning, avec le compte personnel du membre de l'équipe. Elle émet
 * un lien de connexion à usage unique (60 s) ; plus de clé d'accès partagée ni de code par e-mail.
 */
const SL_ADMIN = (process.env.NEXT_PUBLIC_SL_ADMIN_URL || "http://localhost:3004").replace(/\/$/, "");

const ERRORS: Record<string, string> = {
    ASSERTION_EXPIRED: "Le lien de connexion a expiré. Relancez l’ouverture depuis Studies Learning.",
    ASSERTION_REPLAYED: "Ce lien de connexion a déjà servi. Relancez l’ouverture depuis Studies Learning.",
    NO_PSP_PERMISSION: "Votre compte n’a aucune permission sur l’agrégateur. Demandez-la à un super-administrateur.",
    SSO_DISABLED: "La connexion de l’équipe n’est pas configurée sur l’agrégateur (PSP_SSO_SECRET).",
    PSP_UNREACHABLE: "L’agrégateur ne répond pas. Réessayez dans un instant.",
    UNTRUSTED_ORIGIN: "Connexion refusée : elle doit partir de l’administration Studies Learning.",
    INVALID_ASSERTION: "Lien de connexion invalide. Relancez l’ouverture depuis Studies Learning.",
};

function LoginCard() {
    const params = useSearchParams();
    const code = params.get("error") || params.get("code");
    const message = code ? ERRORS[code] ?? ERRORS.INVALID_ASSERTION : null;

    return (
        <div className="relative w-full max-w-[480px]">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-8 shadow-[0_40px_120px_-40px_rgba(124,58,237,0.6)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-violet-500/30">
                        <ShieldCheck className="h-6 w-6" />
                    </span>
                    <div>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-violet-300">Studies Learning</p>
                        <h1 className="text-[24px] font-semibold text-white">Agrégateur de paiement</h1>
                    </div>
                </div>

                <p className="mt-6 text-[14.5px] leading-relaxed text-slate-300">
                    L’administration des paiements s’ouvre depuis votre compte Studies Learning. Vous y entrez avec votre identité et vos seules
                    permissions ; chaque action est journalisée à votre nom.
                </p>

                {message && (
                    <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-[13.5px] text-red-100">
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{message}</span>
                    </div>
                )}

                <a
                    href={`${SL_ADMIN}/admin/agregateur`}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_14px_32px_-12px_rgba(124,58,237,0.9)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                >
                    Se connecter avec Studies Learning
                    <ArrowUpRight className="h-4 w-4" />
                </a>

                <ul className="mt-6 space-y-2 text-[12.5px] text-slate-400">
                    <li className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-violet-300" />Session personnelle de 8 heures</li>
                    <li className="flex items-center gap-2"><Lock className="h-4 w-4 text-violet-300" />Lien de connexion à usage unique, valable 60 secondes</li>
                </ul>
            </div>
            <p className="mt-6 text-center text-[12px] text-slate-500">Accès réservé à l’équipe Studies Learning</p>
        </div>
    );
}

export default function LoginPage() {
    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0820] px-4 py-12">
            <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet-600/25 blur-[120px]" />
            <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-40 h-[560px] w-[560px] rounded-full bg-indigo-500/20 blur-[140px]" />
            <Suspense fallback={null}><LoginCard /></Suspense>
        </main>
    );
}
