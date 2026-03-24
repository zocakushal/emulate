import { beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { authMiddleware, Store, type TokenMap, WebhookDispatcher } from "@internal/core";
import { glossgeniusPlugin, seedFromConfig } from "../index.js";

const base = "http://localhost:4000";

function createTestApp() {
  const store = new Store();
  const webhooks = new WebhookDispatcher();
  const tokenMap: TokenMap = new Map();
  tokenMap.set("test-token", {
    login: "stylist@example.com",
    id: 1,
    scopes: ["appointments:read"],
  });

  const app = new Hono();
  app.use("*", authMiddleware(tokenMap, undefined, { login: "stylist@example.com", id: 1, scopes: ["appointments:read"] }));
  glossgeniusPlugin.register(app as any, store, webhooks, base, tokenMap);
  glossgeniusPlugin.seed?.(store, base);
  seedFromConfig(store, base, {
    businesses: [{ slug: "demo-salon", name: "Demo Salon", access_token: "gg_demo_token" }],
    providers: [{ name: "Alex Artist", business_slug: "demo-salon" }],
    services: [{ name: "Consultation", price: "80.00", duration: 60, business_slug: "demo-salon", category: "Services" }],
    reviews: [{ rating: 5, message: "Amazing!", reviewer_name: "A Client", business_slug: "demo-salon" }],
  });

  return { app };
}

describe("Glossgenius plugin integration", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp().app;
  });

  it("GET /v3/appointments returns appointments for bearer auth", async () => {
    const res = await app.request(`${base}/v3/appointments`, {
      headers: {
        Authorization: "Bearer gg_test_salon_token",
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ clientName: string }> };
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]?.clientName).toBe("John Doe");
  });

  it("GET /v3/web/available_times returns public slots", async () => {
    const res = await app.request(`${base}/v3/web/available_times?slug=test-salon&month=5&year=2026`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ date: string; times: unknown[] }> };
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]?.times?.length).toBeGreaterThan(0);
  });

  it("GET /v3/web/portfolio_images returns public portfolio images", async () => {
    const res = await app.request(`${base}/v3/web/portfolio_images?slug=test-salon&limit=10`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ image: { original: string } }> };
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]?.image.original).toContain("portfolio");
  });

  it("GET /v3/web/reviews returns public reviews", async () => {
    const res = await app.request(`${base}/v3/web/reviews?slug=demo-salon&limit=10`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ reviewer_name: string }> };
    expect(body.data[0]?.reviewer_name).toBe("A Client");
  });
});
