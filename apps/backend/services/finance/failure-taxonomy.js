/**
 * Taxonomie des échecs de paiement (ADR-0019, D5) — fonctions pures
 * =================================================================
 * Chaque erreur d'un prestataire (code, message, réponse) est rangée dans une catégorie comprise par l'équipe, avec
 * une EXPLICATION et une ACTION recommandée. Les intentions jamais payées au-delà d'un délai deviennent des abandons.
 * L'ordre des règles compte : la plus spécifique d'abord.
 */

export const CATEGORIES = Object.freeze({
    insufficient_funds: {
        label: "Fonds insuffisants", owner: "client", tone: "warning",
        explanation: "Le compte Mobile Money ou la carte du client ne disposait pas du montant au moment du paiement.",
        action: "Rien à corriger côté plateforme. Relancer le client, proposer un autre moyen ou un paiement plus tard.",
    },
    declined: {
        label: "Refusé par l’émetteur", owner: "client", tone: "warning",
        explanation: "La banque ou l’opérateur a refusé l’opération (plafond, carte non autorisée en ligne, contrôle interne).",
        action: "Inviter le client à contacter sa banque ou son opérateur, ou à utiliser un autre moyen de paiement.",
    },
    customer_cancelled: {
        label: "Annulé par le client", owner: "client", tone: "neutral",
        explanation: "Le client a interrompu le paiement (fermeture de la page, refus de validation sur son téléphone).",
        action: "Surveiller la proportion : une hausse signale une friction (prix, étapes, confiance, lenteur de la page).",
    },
    validation_failed: {
        label: "Validation non faite", owner: "client", tone: "warning",
        explanation: "Le client n’a pas confirmé l’opération (code OTP erroné ou expiré, notification non validée).",
        action: "Rappeler dans le parcours qu’il faut valider sur le téléphone ; vérifier la clarté des instructions affichées.",
    },
    abandoned: {
        label: "Abandon avant paiement", owner: "parcours", tone: "neutral",
        explanation: "La commande a été créée mais aucun paiement n’a abouti dans le délai : le client n’est pas allé au bout.",
        action: "Analyser l’étape d’abandon (choix du moyen, redirection, page du prestataire) et relancer les paniers récents.",
    },
    invalid_details: {
        label: "Coordonnées invalides", owner: "client", tone: "warning",
        explanation: "Numéro de téléphone, opérateur ou données de carte incorrects ou non éligibles.",
        action: "Renforcer le contrôle de saisie (format du numéro par pays, opérateur détecté) avant l’envoi au prestataire.",
    },
    amount_limit: {
        label: "Montant hors limites", owner: "configuration", tone: "danger",
        explanation: "Le montant dépasse un plafond (ou n’atteint pas le minimum) du prestataire ou du compte client.",
        action: "Vérifier les tranches de montant des règles de priorité et prévoir une bascule vers un prestataire adapté.",
    },
    provider_unavailable: {
        label: "Prestataire indisponible", owner: "prestataire", tone: "danger",
        explanation: "Le prestataire n’a pas répondu (panne, délai dépassé, erreur réseau).",
        action: "Vérifier sa santé ; s’il persiste, le passer en maintenance pour que les bascules prennent le relais.",
    },
    configuration: {
        label: "Configuration", owner: "configuration", tone: "danger",
        explanation: "Le prestataire a rejeté la demande de l’agrégateur (identifiants, site, champ obligatoire, devise non activée).",
        action: "Corriger la configuration (identifiants dans l’environnement, devise activée chez le prestataire) puis tester la préparation.",
    },
    fraud_suspected: {
        label: "Suspicion de fraude", owner: "risque", tone: "danger",
        explanation: "Le prestataire a bloqué l’opération par ses contrôles de risque.",
        action: "Examiner le client et la commande ; ne pas forcer un nouveau paiement sans vérification.",
    },
    unknown: {
        label: "Non classé", owner: "à analyser", tone: "neutral",
        explanation: "Le prestataire n’a pas donné de motif exploitable.",
        action: "Ouvrir la transaction pour lire la réponse brute du prestataire ; enrichir la taxonomie si le cas se répète.",
    },
});

/** Codes connus (CinetPay, Stripe) → catégorie. */
const CODES = {
    "602": "insufficient_funds", INSUFFICIENT_BALANCE: "insufficient_funds",
    "600": "declined", PAYMENT_FAILED: "declined",
    "604": "validation_failed", OTP_CODE_ERROR: "validation_failed",
    "608": "configuration", MINIMUM_REQUIRED_FIELDS: "configuration",
    "609": "configuration", AUTH_NOT_FOUND: "configuration",
    "627": "customer_cancelled", TRANSACTION_CANCEL: "customer_cancelled",
    card_declined: "declined", do_not_honor: "declined", insufficient_funds: "insufficient_funds",
    expired_card: "invalid_details", incorrect_number: "invalid_details", incorrect_cvc: "invalid_details",
    fraudulent: "fraud_suspected", amount_too_large: "amount_limit", amount_too_small: "amount_limit",
};

const PATTERNS = [
    ["insufficient_funds", /insufficient|insuffisant|solde|fonds/i],
    ["fraud_suspected", /fraud|risk|suspect|bloqu/i],
    ["customer_cancelled", /cancel|annul|abandon(n)?ed by|user.?closed/i],
    ["validation_failed", /otp|validat|confirm(ation)? (non|not)|pin/i],
    ["invalid_details", /invalid (phone|number|msisdn|card)|num[ée]ro|wrong number|incorrect/i],
    ["amount_limit", /limit|plafond|too (high|large|small|low)|minimum amount|maximum amount/i],
    ["configuration", /api.?key|apikey|site.?id|unauthori[sz]ed|forbidden|\b40[13]\b|credential|currency not|devise|not activated|required field/i],
    ["provider_unavailable", /network|econn|etimedout|timeout|fetch failed|unavailable|indisponible|\b50[0-4]\b|socket|dns/i],
    ["declined", /declin|refus|reject|denied|not honou?red/i],
];

/**
 * Classe un échec.
 * @param {{ errorCode?: string|null, errorMessage?: string|null, response?: unknown, status?: string, abandoned?: boolean }} input
 * @returns {{ category: string } & (typeof CATEGORIES)[keyof typeof CATEGORIES]}
 */
export function classify(input = {}) {
    if (input.abandoned) return { category: "abandoned", ...CATEGORIES.abandoned };
    const code = String(input.errorCode ?? "").trim();
    const known = CODES[code] ?? CODES[code.toUpperCase()] ?? CODES[code.toLowerCase()];
    if (known) return { category: known, ...CATEGORIES[known] };
    const text = [code, input.errorMessage, typeof input.response === "string" ? input.response : JSON.stringify(input.response ?? "")].join(" ");
    for (const [category, re] of PATTERNS) if (re.test(text)) return { category, ...CATEGORIES[category] };
    if (input.status === "canceled") return { category: "customer_cancelled", ...CATEGORIES.customer_cancelled };
    return { category: "unknown", ...CATEGORIES.unknown };
}
