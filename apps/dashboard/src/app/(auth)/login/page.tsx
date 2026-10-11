"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AlertCircle, ArrowUpRight, Fingerprint, Lock, ShieldCheck } from "lucide-react";
import { Blason } from "@/components/brand/BrandMark";

/**
 * Connexion à l'espace finance (ADR-0018 D5.2, ADR-0019 D1)
 * Une seule porte : l'administration Studies Learning, avec le compte personnel du membre de l'équipe. Elle émet un lien
 * de connexion à usage unique (60 s) ; plus de clé d'accès partagée ni de code par e-mail.
 */
const SL_ADMIN = (process.env.NEXT_PUBLIC_SL_ADMIN_URL || "http://localhost:3004").replace(/\/$/, "");

const ERRORS: Record<string, string> = {
    ASSERTION_EXPIRED: "Le lien de connexion a expiré. Relancez l’ouverture depuis Studies Learning.",
    ASSERTION_REPLAYED: "Ce lien de connexion a déjà servi. Relancez l’ouverture depuis Studies Learning.",
    NO_PSP_PERMISSION: "Votre compte n’a aucune permission sur l’agrégateur. Demandez-la à un super-administrateur.",
    SSO_DISABLED: "La connexion de l’équipe n’est pas configurée sur l’agrégateur (PSP_SSO_SECRET).",
    PSP_UNREACHABLE: "L’agrégateur ne répond pas. Réessayez dans un instant.",
    UNTRUSTED_ORIGIN: "Connexion refusée : elle doit partir de l’administration Studies Learning.",
    SSO_RELAUNCH: "Ce lien de connexion ne sert qu’une fois et ne peut pas être rechargé. Rouvrez l’espace finance depuis Studies Learning.",
    INVALID_ASSERTION: "Lien de connexion invalide. Relancez l’ouverture depuis Studies Learning.",
    SESSION_EXPIRED: "Votre session a expiré. Rouvrez l’espace finance depuis Studies Learning.",
};

function LoginCard() {
    const params = useSearchParams();
    const code = params.get("error") || params.get("code");
    const message = code ? ERRORS[code] ?? ERRORS.INVALID_ASSERTION : null;

    return (
        <div className="w-full max-w-md animate-slide-up">
            <div className="card p-8">
                <div className="flex flex-col items-center text-center">
                    <Blason size={84} />
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Studies Learning</p>
                    <h1 className="mt-1 text-2xl font-bold text-text-main">Espace finance et paiements</h1>
                    <p className="mt-3 text-sm leading-relaxed text-text-light">
                        Prestataires, règles de priorité, revenus et supervision des paiements. L’accès s’ouvre depuis votre compte Studies Learning,
                        avec vos seules permissions ; chaque action est journalisée à votre nom.
                    </p>
                </div>

                {message && (
                    <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger-dark">
                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                        <span>{message}</span>
                    </div>
                )}

                <a href={`${SL_ADMIN}/admin/agregateur`} className="btn-primary mt-6 w-full justify-center py-3 text-sm">
                    Se connecter avec Studies Learning
                    <ArrowUpRight size={16} />
                </a>

                <ul className="mt-6 space-y-2 border-t border-border pt-5 text-xs text-text-light">
                    <li className="flex items-center gap-2"><Fingerprint size={14} className="text-primary" />Session personnelle de 8 heures</li>
                    <li className="flex items-center gap-2"><Lock size={14} className="text-primary" />Lien de connexion à usage unique, valable 60 secondes</li>
                    <li className="flex items-center gap-2"><ShieldCheck size={14} className="text-primary" />Droits attribués dans « Équipe et accès »</li>
                </ul>
            </div>
            <p className="mt-6 text-center text-xs text-text-light">Accès réservé à l’équipe Studies Learning</p>
        </div>
    );
}

export default function LoginPage() {
    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
            <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-[110px]" />
            <div className="relative w-full flex justify-center"><Suspense fallback={null}><LoginCard /></Suspense></div>
        </main>
    );
}
