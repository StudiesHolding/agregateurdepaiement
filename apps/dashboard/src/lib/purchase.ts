/**
 * Vocabulaire des achats (ADR-0019) : une formation se paie par une INSCRIPTION, un package ou une thématique
 * d'entreprise par un ACHAT DE LICENCES, une candidature par des FRAIS DE DOSSIER.
 */
export type PurchaseKind = "enrollment" | "licences" | "admission";

const parse = (m: unknown): Record<string, unknown> => {
    if (!m) return {};
    if (typeof m === "string") { try { return JSON.parse(m); } catch { return {}; } }
    return m as Record<string, unknown>;
};

export function purchaseKind(o: { lmsItemType?: string | null; metadata?: unknown } | null | undefined): PurchaseKind {
    const m = parse(o?.metadata);
    if (m.purchase_type === "ADMISSION_FEE") return "admission";
    if (m.is_b2b || m.b2b_purchase || m.purchase_type === "B2B_PACKAGE" || m.thematique_id || ["package", "thematique"].includes(o?.lmsItemType ?? "")) return "licences";
    return "enrollment";
}

const WORDS = {
    enrollment: { Noun: "Inscription", the: "l’inscription", this: "cette inscription", fem: true },
    licences: { Noun: "Achat de licences", the: "l’achat de licences", this: "cet achat de licences", fem: false },
    admission: { Noun: "Dossier de candidature", the: "le dossier de candidature", this: "ce dossier de candidature", fem: false },
} as const;

export const purchaseWords = (o: Parameters<typeof purchaseKind>[0]) => WORDS[purchaseKind(o)];
/** Accorde un participe : « validé » → « validée » pour une inscription. */
export const agree = (w: { fem: boolean }, participle: string) => (w.fem ? `${participle}e` : participle);
