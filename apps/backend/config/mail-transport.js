/**
 * Configuration SMTP centralisée — test (Mailpit) vs production (Ionos, etc.)
 *
 * Règle :
 *   NODE_ENV=test  → Mailpit local (localhost:1025, pas de TLS)
 *   production     → SMTP réel (variables MAIL_* du serveur)
 */
export function resolveMailTransportFromEnv(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const isTest = nodeEnv === "test";

  const host = env.MAIL_HOST || (isTest ? "localhost" : undefined);
  // Mailpit SMTP écoute sur le port 1025, son UI est sur 8025
  const port = parseInt(env.MAIL_PORT || (isTest ? "1025" : "465"), 10);

  // Mailpit (port 1025) ne supporte PAS SSL/TLS → secure doit être false
  // Ionos (port 465) nécessite secure=true
  // Si MAIL_SECURE est explicitement défini, on l'utilise
  // Sinon, on déduit : port 465 → secure, port 1025 → pas secure
  const secure =
    env.MAIL_SECURE === "true"
      ? true
      : env.MAIL_SECURE === "false"
        ? false
        : port === 465;

  const auth =
    env.MAIL_USER && env.MAIL_PASS
      ? { user: env.MAIL_USER, pass: env.MAIL_PASS }
      : undefined;

  return {
    host,
    port,
    secure,
    auth,
    fromName: env.MAIL_FROM_NAME || "Studies Learning",
    fromEmail: env.MAIL_FROM_EMAIL || "no-reply@studieslearning.com",
    /** true = emails capturés localement (Mailpit), jamais livrés sur Internet */
    usesMailpit: isTest || (host === "localhost" && port === 1025),
  };
}
