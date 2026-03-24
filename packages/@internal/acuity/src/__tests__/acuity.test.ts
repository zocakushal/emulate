import { beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { authMiddleware, Store, type TokenMap, WebhookDispatcher } from "@internal/core";
import { acuityPlugin, seedFromConfig } from "../index.js";

const base = "http://localhost:4000";
const authHeaders = {
  Authorization: "Bearer test-token",
};

function createTestApp() {
  const store = new Store();
  const webhooks = new WebhookDispatcher();
  const tokenMap: TokenMap = new Map();
  tokenMap.set("test-token", {
    login: "owner@example.com",
    id: 1,
    scopes: ["api-v1"],
  });

  const app = new Hono();
  app.use("*", authMiddleware(tokenMap, undefined, { login: "owner@example.com", id: 1, scopes: ["api-v1"] }));
  acuityPlugin.register(app as any, store, webhooks, base, tokenMap);
  acuityPlugin.seed?.(store, base);
  seedFromConfig(store, base, {
    oauth_clients: [
      {
        client_id: "test-client-id",
        client_secret: "test-client-secret",
        redirect_uris: ["http://localhost:3000/callback"],
      },
    ],
  });

  return { app };
}

async function issueOAuthCode(app: Hono): Promise<string> {
  const authorizeRes = await app.request(
    `${base}/oauth2/authorize?client_id=test-client-id&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&state=acuity-state&scope=api-v1`
  );
  expect(authorizeRes.status).toBe(200);
  const authorizeHtml = await authorizeRes.text();
  expect(authorizeHtml).toContain("Sign in to Acuity");

  const callbackRes = await app.request(`${base}/oauth2/authorize/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      owner_id: "1",
      client_id: "test-client-id",
      redirect_uri: "http://localhost:3000/callback",
      state: "acuity-state",
      scope: "api-v1",
    }).toString(),
    redirect: "manual",
  });

  expect(callbackRes.status).toBe(302);
  const location = callbackRes.headers.get("location");
  expect(location).toBeTruthy();
  expect(new URL(location!).searchParams.get("state")).toBe("acuity-state");

  const code = new URL(location!).searchParams.get("code");
  expect(code).toBeTruthy();
  return code!;
}

describe("Acuity plugin integration", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp().app;
  });

  it("covers the OAuth authorize and token exchange flow", async () => {
    const code = await issueOAuthCode(app);

    const tokenRes = await app.request(`${base}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: "http://localhost:3000/callback",
        client_id: "test-client-id",
        client_secret: "test-client-secret",
      }).toString(),
    });

    expect(tokenRes.status).toBe(200);
    const tokenBody = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      owner: { displayName: string };
    };
    expect(tokenBody.access_token).toBeTruthy();
    expect(tokenBody.refresh_token).toBeTruthy();
    expect(tokenBody.owner.displayName).toBe("Test Owner");
  });

  it("returns owner, appointment types, and calendars", async () => {
    const meRes = await app.request(`${base}/api/v1/me`, {
      headers: authHeaders,
    });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { displayName: string };
    expect(meBody.displayName).toBe("Test Owner");

    const typesRes = await app.request(`${base}/api/v1/appointment-types`, {
      headers: authHeaders,
    });
    expect(typesRes.status).toBe(200);
    const typesBody = (await typesRes.json()) as Array<{ name: string }>;
    expect(typesBody[0]?.name).toBe("Consultation");

    const calendarsRes = await app.request(`${base}/api/v1/calendars`, {
      headers: authHeaders,
    });
    expect(calendarsRes.status).toBe(200);
    const calendarsBody = (await calendarsRes.json()) as Array<{ name: string }>;
    expect(calendarsBody[0]?.name).toBe("Main Calendar");
  });

  it("returns availability dates and times", async () => {
    const datesRes = await app.request(`${base}/api/v1/availability/dates?month=2026-05`, {
      headers: {
        Authorization: "Bearer test-token",
      },
    });
    expect(datesRes.status).toBe(200);
    const datesBody = (await datesRes.json()) as Array<{ date: string }>;
    expect(datesBody[0]?.date).toContain("2026-05");

    const timesRes = await app.request(`${base}/api/v1/availability/times?date=2026-05-01&maxDays=2`, {
      headers: authHeaders,
    });
    expect(timesRes.status).toBe(200);
    const timesBody = (await timesRes.json()) as Record<string, Array<{ time: string }>>;
    expect(Object.keys(timesBody)).toContain("2026-05-01");
    expect(timesBody["2026-05-01"]?.length).toBeGreaterThan(0);
  });

  it("creates, lists, fetches, and returns payments for appointments", async () => {
    const createRes = await app.request(`${base}/api/v1/appointments`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appointmentTypeID: 1,
        datetime: "2026-05-01T14:00:00.000Z",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        calendarID: 1,
        phone: "+15551234567",
      }),
    });
    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as { id: number; firstName: string };
    expect(createBody.firstName).toBe("John");

    const listRes = await app.request(`${base}/api/v1/appointments?calendarID=1&minDate=2026-05-01`, {
      headers: authHeaders,
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as Array<{ id: number }>;
    expect(listBody.some((appointment) => appointment.id === createBody.id)).toBe(true);

    const getRes = await app.request(`${base}/api/v1/appointments/${createBody.id}`, {
      headers: authHeaders,
    });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { id: number; email: string };
    expect(getBody.id).toBe(createBody.id);
    expect(getBody.email).toBe("john@example.com");

    const paymentsRes = await app.request(`${base}/api/v1/appointments/${createBody.id}/payments`, {
      headers: authHeaders,
    });
    expect(paymentsRes.status).toBe(200);
    const paymentsBody = (await paymentsRes.json()) as Array<{ status: string }>;
    expect(paymentsBody[0]?.status).toBe("paid");
  });

  it("cancels an existing appointment", async () => {
    const res = await app.request(`${base}/api/v1/appointments/2001/cancel`, {
      method: "PUT",
      headers: authHeaders,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { canceled: boolean };
    expect(body.canceled).toBe(true);
  });
});
