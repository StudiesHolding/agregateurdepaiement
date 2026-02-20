import request from "supertest";
import app from "../../app.js";
import { sequelize } from "../../models/index.js";
import { ApiKeyService } from "../../services/api-key.service.js";
import { AnalyticsService } from "../../services/analytics.service.js";
import { LmsBridgeService } from "../../services/lms-bridge.service.js";
import { jest } from "@jest/globals";

const ADMIN_KEY = "admin:secret_key";
const USER_KEY = "user:normal_key";

describe("Admin API Integration & Security", () => {
    beforeAll(async () => {
        // Prevent real DB connection
        jest.spyOn(sequelize, 'authenticate').mockResolvedValue();
        jest.spyOn(sequelize, 'sync').mockResolvedValue();

        // Mock API Key validation with prefix-based RBAC
        jest.spyOn(ApiKeyService, 'findByKey').mockImplementation(async (key) => {
            if (key === ADMIN_KEY) return { id: 1, owner: 'admin:test', isActive: true };
            if (key === USER_KEY) return { id: 2, owner: 'user:normal', isActive: true };
            return null;
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe("Security / RBAC", () => {
        test("SHOULD block request without API Key", async () => {
            const res = await request(app).get("/api/admin/kpis/overview");
            expect(res.statusCode).toEqual(401);
        });

        test("SHOULD block non-admin key from accessing admin routes", async () => {
            const res = await request(app)
                .get("/api/admin/kpis/overview")
                .set("X-API-KEY", USER_KEY);
            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toContain("Insufficient privileges");
        });

        test("SHOULD allow admin key to access admin routes", async () => {
            jest.spyOn(AnalyticsService, 'getOverviewKpis').mockResolvedValue({
                revenue24h: 150000
            });

            const res = await request(app)
                .get("/api/admin/kpis/overview")
                .set("X-API-KEY", ADMIN_KEY);
            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toBeDefined();
        });
    });

    describe("KPIs & Analytics", () => {
        test("GET /api/admin/kpis/overview should return unified KPIs", async () => {
            const mockKPIs = {
                revenue24h: 150000,
                successRate: 98.5,
                transactionCount: 45,
                failoverRate: 2.1
            };
            jest.spyOn(AnalyticsService, 'getOverviewKpis').mockResolvedValue(mockKPIs);

            const res = await request(app)
                .get("/api/admin/kpis/overview")
                .set("X-API-KEY", ADMIN_KEY);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.revenue24h).toEqual(150000);
        });

        test("GET /api/admin/kpis/lms should call LMS bridge methods", async () => {
            jest.spyOn(LmsBridgeService, 'getTopFormations').mockResolvedValue([]);
            jest.spyOn(LmsBridgeService, 'getWalletSummary').mockResolvedValue({ activeWallets: 5 });
            jest.spyOn(LmsBridgeService, 'getFormationsStats').mockResolvedValue({ totalPublished: 120 });

            const res = await request(app)
                .get("/api/admin/kpis/lms")
                .set("X-API-KEY", ADMIN_KEY);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.formationsStats.totalPublished).toEqual(120);
        });
    });

    describe("Provider Management & Routes", () => {
        test("GET /api/admin/providers should return provider performance", async () => {
            jest.spyOn(AnalyticsService, 'getProviderPerformance').mockResolvedValue([]);

            const res = await request(app)
                .get("/api/admin/providers")
                .set("X-API-KEY", ADMIN_KEY);

            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        test("GET /api/admin/routes/matrix should return matrix info", async () => {
            // This test verifies the route is accessible and controller runs
            const res = await request(app)
                .get("/api/admin/routes/matrix")
                .set("X-API-KEY", ADMIN_KEY);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toBeDefined();
        });
    });
});
