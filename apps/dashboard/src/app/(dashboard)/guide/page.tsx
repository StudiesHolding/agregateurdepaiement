"use client";

/**
 * Guide de l'espace finance (ADR-0019, F8)
 * ========================================
 * Réservé à l'équipe connectée. Deux volets : utiliser chaque écran, et l'intégration technique (connexion,
 * permissions, confirmation des paiements, configuration). Remplace l'ancienne documentation publique, obsolète.
 */
import Link from "next/link";
import { useState } from "react";
import {
    AlertTriangle, ArrowRight, BarChart3, Bell, BookOpen, Code2, GitBranch, GraduationCap, KeyRound, LayoutDashboard, Scale,
    ShieldCheck, Activity, Webhook, FileText, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "usage" | "technique";

const SCREENS = [
    { href: "/", icon: LayoutDashboard, title: "Centre de pilotage", text: "Commencez ici chaque jour. « À traiter maintenant » classe les urgences (écarts de rapprochement, confirmations suspectes, prestataires non prêts, voies sans prestataire) ; chaque point ouvre l’écran où agir." },
    { href: "/revenue", icon: BarChart3, title: "Revenus", text: "D’où vient l’argent : brut, frais des prestataires (selon leur barème), net ; par pays, prestataire, moyen, produit et canal. Les montants par devise sont exacts ; l’équivalent utilise la grille de taux de Studies Learning, datée." },
    { href: "/failures", icon: AlertTriangle, title: "Échecs et frictions", text: "L’entonnoir du paiement (achats lancés, ouverts chez un prestataire, confirmés), les abandons et chaque cause d’échec avec son explication et la marche à suivre. Une hausse d’« annulé par le client » signale une friction dans le parcours." },
    { href: "/reconciliation", icon: Scale, title: "Rapprochement", text: "Chaque paiement confirmé doit avoir son inscription ou son achat de licences à jour et son accès livré ; chaque achat payé, sa preuve de paiement. Un écart en rouge est un client payé sans être servi, ou un accès sans paiement." },
    { href: "/transactions", icon: FileText, title: "Transactions", text: "Toutes les intentions de paiement et leurs tentatives, avec la réponse du prestataire. Recherche par e-mail ou par référence (INS- pour une inscription, LIC- pour un achat de licences)." },
    { href: "/orders", icon: GraduationCap, title: "Inscriptions et licences", text: "Le cycle de chaque achat, du paiement à l’accès. La plupart sont traités automatiquement ; l’ancien flux manuel demande une validation de l’équipe." },
    { href: "/webhooks", icon: Webhook, title: "Webhooks", text: "Les notifications des prestataires. Une notification non traitée porte son motif (vérification impossible, référence inconnue…) ; rejouez-la une fois la cause corrigée." },
    { href: "/providers", icon: Activity, title: "Prestataires", text: "Santé, préparation (identifiants présents sur le serveur, jamais affichés), mode test ou production, barème de frais, délai de reversement. Une panne ? Passez le prestataire en maintenance avec un motif : les bascules prennent le relais." },
    { href: "/routing", icon: GitBranch, title: "Règles de priorité", text: "Pour chaque voie (pays × devise × moyen), l’ordre d’essai des prestataires : le premier encaisse, les suivants prennent le relais en cas d’échec technique. Glissez pour réordonner ; le simulateur explique chaque décision. Visez au moins deux prestataires par voie." },
    { href: "/settings/notifications", icon: Bell, title: "Notifications", text: "Qui est prévenu de quoi, par quel canal (centre, e-mail, son) et quand (heures calmes, anti-répétition). Renseignez des destinataires pour les règles e-mail, puis faites un essai : le journal d’envoi montre chaque envoi." },
    { href: "/audit", icon: ShieldCheck, title: "Journal d’audit", text: "Chaque action de l’équipe sur l’agrégateur, à son nom, avec son résultat (réussite, refus, erreur). Les identifiants des prestataires n’y apparaissent jamais." },
];

const PERMISSIONS = [
    { slug: "psp.view", label: "Consultation", text: "Tous les écrans, sans modification." },
    { slug: "psp.providers.manage", label: "Prestataires et routage", text: "Inscrire, activer, mettre en maintenance un prestataire, régler ses frais ; créer et ordonner les règles de priorité." },
    { slug: "psp.operations.manage", label: "Opérations", text: "Rejouer un webhook, valider ou finaliser une inscription ou un achat de licences, régler les notifications." },
    { slug: "psp.companies.manage", label: "Entreprises", text: "Demandes d’accès et administrateurs des entreprises." },
];

const ENV = [
    { name: "PSP_SSO_SECRET", where: "Agrégateur et backend Studies Learning (identique)", text: "Signe les liens de connexion de l’équipe (32 caractères au moins)." },
    { name: "JWT_SECRET", where: "Agrégateur", text: "Signe les sessions de 8 h. Sans lui, l’agrégateur refuse de démarrer en production." },
    { name: "PSP_DASHBOARD_URL", where: "Backend Studies Learning, agrégateur", text: "Adresse de cet espace (lien de connexion, liens des e-mails d’alerte)." },
    { name: "AUTH_SECRET, AUTH_URL", where: "Espace finance", text: "Session chiffrée du navigateur et adresse publique de l’espace." },
    { name: "PSP_API_URL", where: "Espace finance", text: "Adresse interne de l’agrégateur." },
    { name: "SL_ADMIN_ORIGINS", where: "Espace finance", text: "Origines autorisées à ouvrir une session (administration Studies Learning), séparées par des virgules." },
    { name: "NEXT_PUBLIC_SL_ADMIN_URL", where: "Espace finance", text: "Adresse de l’administration Studies Learning (bouton de connexion)." },
    { name: "SL_BACKEND_URL", where: "Agrégateur", text: "Backend Studies Learning (grille de taux, inscriptions, commissions)." },
    { name: "STRIPE_SECRET_KEY, CINETPAY_*, KKIAPAY_*", where: "Agrégateur", text: "Identifiants des prestataires, dans le gestionnaire de secrets ; KKIAPAY_WEBHOOK_SECRET rend la signature obligatoire." },
];

function Section({ icon: Icon, title, children }: { icon: typeof BookOpen; title: string; children: React.ReactNode }) {
    return (
        <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-text-main"><Icon size={18} className="text-primary" />{title}</h2>
            {children}
        </section>
    );
}

export default function GuidePage() {
    const [tab, setTab] = useState<Tab>("usage");
    return (
        <div className="mx-auto max-w-5xl space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="page-title">Guide de <span className="gradient-text">l’espace finance</span></h1>
                    <p className="mt-1 max-w-2xl text-sm text-text-light">Comment piloter les paiements de Studies Learning, et comment l’espace est relié au reste de la plateforme.</p>
                </div>
                <div className="flex rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Volet du guide">
                    {([["usage", "Utiliser l’espace", BookOpen], ["technique", "Intégration technique", Code2]] as const).map(([id, label, Icon]) => (
                        <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold", tab === id ? "bg-primary text-white" : "text-text-light hover:text-text-main")}>
                            <Icon size={13} />{label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === "usage" ? (
                <>
                    <Section icon={BookOpen} title="Les écrans">
                        <div className="grid gap-3 md:grid-cols-2">
                            {SCREENS.map((s) => (
                                <Link key={s.href} href={s.href} className="group rounded-2xl border border-border p-4 transition hover:border-primary hover:shadow-card">
                                    <p className="flex items-center justify-between text-sm font-bold text-text-main"><span className="flex items-center gap-2"><s.icon size={15} className="text-primary" />{s.title}</span><ArrowRight size={14} className="text-text-light transition group-hover:translate-x-0.5 group-hover:text-primary" /></p>
                                    <p className="mt-1.5 text-xs leading-relaxed text-text-light">{s.text}</p>
                                </Link>
                            ))}
                        </div>
                    </Section>
                    <Section icon={Settings2} title="Les bons réflexes">
                        <ul className="space-y-2 text-sm text-text-main">
                            <li>Deux prestataires au moins par voie : une panne du prestataire unique bloque tous les paiements de la voie.</li>
                            <li>Renseignez le barème de frais de chaque prestataire : sans lui, le revenu net est surestimé.</li>
                            <li>Un prestataire en panne se met en maintenance (avec un motif), pas en désactivation : la maintenance se lève à l’échéance et reste lisible par l’équipe.</li>
                            <li>Un paiement n’est jamais validé à la main sur la seule foi d’une notification : seule la confirmation du prestataire fait foi.</li>
                            <li>Aucun remboursement : les litiges se constatent, ils ne se traitent pas depuis l’agrégateur.</li>
                        </ul>
                    </Section>
                </>
            ) : (
                <>
                    <Section icon={KeyRound} title="Connexion de l’équipe">
                        <ol className="list-decimal space-y-2 pl-5 text-sm text-text-main">
                            <li>Dans l’administration Studies Learning, « Agrégateur de paiement » → « Ouvrir l’agrégateur ».</li>
                            <li>Le backend Studies Learning émet une assertion signée (60 secondes, usage unique) avec les seules permissions <code className="rounded bg-background px-1">psp.*</code> du membre.</li>
                            <li>Le navigateur la poste à cet espace (formulaire, jamais dans l’adresse) ; l’espace vérifie son origine et l’échange auprès de l’agrégateur contre une session personnelle de 8 heures.</li>
                        </ol>
                        <p className="mt-3 text-xs text-text-light">Aucune clé partagée pour les personnes. Les intégrations machine (scripts d’exploitation) utilisent une clé créée avec <code className="rounded bg-background px-1">node scripts/create-machine-key.js &lt;nom&gt;</code>, affichée une seule fois.</p>
                    </Section>
                    <Section icon={ShieldCheck} title="Permissions (Équipe et accès, dans Studies Learning)">
                        <ul className="divide-y divide-border">
                            {PERMISSIONS.map((p) => (
                                <li key={p.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                                    <span className="font-semibold text-text-main">{p.label} <code className="ml-1 rounded bg-background px-1 text-xs font-normal text-text-light">{p.slug}</code></span>
                                    <span className="text-xs text-text-light">{p.text}</span>
                                </li>
                            ))}
                        </ul>
                    </Section>
                    <Section icon={Webhook} title="Confirmation des paiements">
                        <ul className="space-y-2 text-sm text-text-main">
                            <li>Une notification de prestataire n’est qu’un signal : l’agrégateur interroge le prestataire (session Stripe, vérification KkiaPay ou CinetPay).</li>
                            <li>La réponse doit correspondre à la tentative : même référence, même montant, même devise. Sinon, refus et alerte « confirmation suspecte ».</li>
                            <li>Signature KkiaPay obligatoire dès que son secret est configuré ; une notification déjà traitée ne relance rien.</li>
                            <li>Adresses à déclarer chez les prestataires : <code className="rounded bg-background px-1">/api/webhooks/stripe</code>, <code className="rounded bg-background px-1">/api/webhooks/cinetpay</code>, <code className="rounded bg-background px-1">/api/webhooks/kkiapay</code>.</li>
                        </ul>
                    </Section>
                    <Section icon={Settings2} title="Configuration du serveur">
                        <div className="overflow-x-auto">
                            <table className="data-table w-full text-xs">
                                <thead><tr><th>Variable</th><th>Où</th><th>Rôle</th></tr></thead>
                                <tbody>{ENV.map((e) => <tr key={e.name}><td className="font-mono font-semibold">{e.name}</td><td>{e.where}</td><td className="text-text-light">{e.text}</td></tr>)}</tbody>
                            </table>
                        </div>
                    </Section>
                    <Section icon={Code2} title="Mise à jour d’une base existante">
                        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-text-main">
                            <li><code className="rounded bg-background px-1">node scripts/schema-doctor.js</code> (lecture seule), puis <code className="rounded bg-background px-1">--apply</code> après sauvegarde : colonnes en double et clés étrangères.</li>
                            <li><code className="rounded bg-background px-1">node scripts/fix-auto-increment.js</code> puis <code className="rounded bg-background px-1">--apply</code>.</li>
                            <li><code className="rounded bg-background px-1">node scripts/migrate-routing-v2.js</code> puis <code className="rounded bg-background px-1">--apply</code> : moyen de paiement des règles, règles implicites rendues explicites.</li>
                            <li>Migrations SQL <code className="rounded bg-background px-1">013_admin_sso_assertions</code> et <code className="rounded bg-background px-1">014_notification_rules</code>.</li>
                        </ol>
                    </Section>
                </>
            )}
        </div>
    );
}
