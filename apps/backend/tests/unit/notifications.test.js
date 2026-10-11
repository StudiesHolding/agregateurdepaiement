import { jest } from "@jest/globals";
import { DEFAULT_RULES, DEFAULT_TIMEZONE, effectiveChannels, inQuietHours, normalizeRule } from "../../services/notifications/notification-catalog.js";
import { deliver, emit } from "../../services/notifications/notification-engine.js";
import { renderTeamAlert } from "../../services/notifications/team-alert-email.js";
import { AdminNotification, NotificationDelivery, NotificationRule } from "../../models/index.js";
import { MailService } from "../../services/mail.service.js";

/** Notifications de l'espace finance (ADR-0019, D7). */
describe("règles de notification", () => {
    it("validation : événement, canaux, destinataires, seuils, heures calmes", () => {
        const r = normalizeRule({ event: "failures.spike", channels: { inApp: true, email: true }, recipients: { emails: ["Finance@SL.test", "finance@sl.test"] }, params: { failureRate: 40 }, quietHours: { from: "22:00", to: "07:00" } });
        expect(r.recipients.emails).toEqual(["finance@sl.test"]);
        expect(r.params).toEqual({ windowMinutes: 60, minAttempts: 10, failureRate: 40 });
        expect(r.quietHours).toEqual({ from: "22:00", to: "07:00", allowDanger: true });
        expect(() => normalizeRule({ event: "inconnu", channels: { inApp: true } })).toThrow(/Événement inconnu/);
        expect(() => normalizeRule({ event: "payment.failed", channels: {} })).toThrow(/au moins un canal/);
        expect(() => normalizeRule({ event: "payment.failed", channels: { email: true }, recipients: { emails: ["pas-un-mail"] } })).toThrow(/invalide/);
        expect(() => normalizeRule({ event: "failures.spike", channels: { inApp: true }, params: { failureRate: 300 } })).toThrow(/Part d’échecs/);
    });

    it("toutes les règles par défaut sont valides", () => {
        for (const d of DEFAULT_RULES) expect(() => normalizeRule({ event: d.event, channels: d.channels, params: d.params ?? {}, recipients: { emails: [] }, timezone: DEFAULT_TIMEZONE })).not.toThrow();
    });

    it("heures calmes (passant minuit) : e-mail et son coupés, sauf urgence si permis", () => {
        const night = new Date("2026-10-10T23:30:00Z"); // 00:30 à Douala
        const day = new Date("2026-10-10T12:00:00Z");
        const rule = { channels: { inApp: true, email: true, sound: true }, quietHours: { from: "22:00", to: "07:00", allowDanger: true }, timezone: "Africa/Douala" };
        expect(inQuietHours(night, rule.quietHours, rule.timezone)).toBe(true);
        expect(inQuietHours(day, rule.quietHours, rule.timezone)).toBe(false);
        expect(effectiveChannels(rule, "warning", night)).toEqual({ inApp: true, email: false, sound: false });
        expect(effectiveChannels(rule, "danger", night)).toEqual({ inApp: true, email: true, sound: true });
    });

    it("courriel : valeurs échappées, marque Studies Learning", () => {
        const html = renderTeamAlert({ title: "Client <script>alert(1)</script>", lines: ["a & b"], severity: "danger", actionUrl: "http://x/failures" });
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
        expect(html).toContain("Studies Learning");
    });
});

describe("moteur de notifications", () => {
    const rule = (over = {}) => ({ id: 3, event: "failures.spike", severity: "danger", channels: { inApp: true, email: true, sound: false }, recipients: { emails: ["finance@sl.test"] }, quietHours: null, timezone: "Africa/Douala", cooldownMinutes: 60, params: {}, ...over });
    beforeEach(() => {
        jest.spyOn(AdminNotification, "create").mockResolvedValue({});
        jest.spyOn(NotificationDelivery, "create").mockResolvedValue({});
        jest.spyOn(MailService, "sendEmail").mockResolvedValue({ messageId: "m1" });
    });
    afterEach(() => jest.restoreAllMocks());

    it("envoie centre + e-mail et journalise chaque envoi", async () => {
        jest.spyOn(NotificationDelivery, "count").mockResolvedValue(0);
        const r = await deliver(rule(), "failures.spike", { title: "Pic", lines: ["x"], key: "k1" });
        expect(r.sent).toEqual(["inApp", "email"]);
        expect(MailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "finance@sl.test", subject: "[Studies Learning · Paiements] Pic" }));
        expect(NotificationDelivery.create).toHaveBeenCalledTimes(2);
    });

    it("anti-répétition : même clé dans la fenêtre = ignorée, sans bruit dans le journal", async () => {
        jest.spyOn(NotificationDelivery, "count").mockResolvedValue(1);
        const r = await deliver(rule(), "failures.spike", { title: "Pic", lines: [], key: "k1" });
        expect(r.skipped).toBe(true);
        expect(AdminNotification.create).not.toHaveBeenCalled();
        expect(NotificationDelivery.create).not.toHaveBeenCalled();
    });

    it("paiement confirmé : seuil de montant respecté (même devise)", async () => {
        jest.spyOn(NotificationDelivery, "count").mockResolvedValue(0);
        jest.spyOn(NotificationRule, "findAll").mockResolvedValue([rule({ event: "payment.succeeded", severity: "info", params: { minAmount: 500000, currency: "XOF" } })]);
        await emit("payment.succeeded", { title: "Petit", lines: [] }, { amount: 60000, currency: "XOF" });
        expect(AdminNotification.create).not.toHaveBeenCalled();
        await emit("payment.succeeded", { title: "Gros", lines: [] }, { amount: 750000, currency: "XOF" });
        expect(AdminNotification.create).toHaveBeenCalledTimes(1);
    });
});
