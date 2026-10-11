/**
 * Vocabulaire des achats (ADR-0019) : on est dans l'e-learning, pas dans la vente à emporter.
 * Une formation se paie par une INSCRIPTION ; un package ou une thématique d'entreprise, par un ACHAT DE LICENCES ;
 * une candidature, par des FRAIS DE DOSSIER. Jamais le vocabulaire de la vente à emporter dans un texte lu par un client ou par l’équipe.
 */
const parse = (m) => {
    if (!m) return {};
    if (typeof m === "string") { try { return JSON.parse(m); } catch { return {}; } }
    return m;
};

/** Nature d'un achat : enrollment | licences | admission. */
export function purchaseKind(order) {
    const m = parse(order?.metadata);
    if (m.purchase_type === "ADMISSION_FEE") return "admission";
    if (m.is_b2b || m.b2b_purchase || m.purchase_type === "B2B_PACKAGE" || m.thematique_id || ["package", "thematique"].includes(order?.lmsItemType)) return "licences";
    return "enrollment";
}

const WORDS = {
    enrollment: { noun: "inscription", Noun: "Inscription", the: "l’inscription", your: "votre inscription", this: "cette inscription", fem: true },
    licences: { noun: "achat de licences", Noun: "Achat de licences", the: "l’achat de licences", your: "votre achat de licences", this: "cet achat de licences", fem: false },
    admission: { noun: "dossier de candidature", Noun: "Dossier de candidature", the: "le dossier de candidature", your: "votre dossier de candidature", this: "ce dossier de candidature", fem: false },
};

/** Mots à employer pour un achat donné (nom, avec article, possessif, démonstratif). */
export const purchaseWords = (order) => WORDS[purchaseKind(order)];

/** Accorde un participe : « validé » → « validée » pour une inscription. */
export const agree = (words, participle) => (words.fem ? `${participle}e` : participle);
