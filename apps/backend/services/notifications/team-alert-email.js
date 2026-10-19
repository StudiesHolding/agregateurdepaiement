/**
 * Courriel d'alerte pour l'équipe (ADR-0019, D7) : gabarit Studies Learning, valeurs échappées (aucune donnée de
 * client ne peut injecter de HTML), lien vers l'action dans l'espace finance.
 */
export const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const TONE = {
    danger: { label: "Urgent", color: "#b91c1c", bg: "#fef2f2" },
    warning: { label: "À surveiller", color: "#b45309", bg: "#fffbeb" },
    info: { label: "Information", color: "#4338ca", bg: "#eef2ff" },
};

export function renderTeamAlert({ title, lines = [], severity = "info", actionUrl = null, actionLabel = "Ouvrir dans l’espace finance" }) {
    const t = TONE[severity] ?? TONE.info;
    const body = lines.filter(Boolean).map((l) => `<p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#1e293b">${escapeHtml(l)}</p>`).join("");
    const button = actionUrl
        ? `<p style="margin:22px 0 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:999px">${escapeHtml(actionLabel)}</a></p>`
        : "";
    return `<!doctype html><html lang="fr"><body style="margin:0;background:#f8fafc;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden">
<tr><td style="background:#1e1b4b;padding:20px 26px">
<p style="margin:0;color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.2px">Studies Learning</p>
<p style="margin:2px 0 0;color:#c4b5fd;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase">Espace finance et paiements</p>
</td></tr>
<tr><td style="padding:26px">
<p style="margin:0 0 12px"><span style="display:inline-block;background:${t.bg};color:${t.color};font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:4px 10px;border-radius:999px">${t.label}</span></p>
<h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:#0f172a">${escapeHtml(title)}</h1>
${body}${button}
</td></tr>
<tr><td style="padding:16px 26px;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;line-height:1.5">
Alerte envoyée selon les règles de notification de l’espace finance. Pour changer ce que vous recevez, ouvrez « Notifications » dans l’espace finance.
</td></tr></table></td></tr></table></body></html>`;
}
