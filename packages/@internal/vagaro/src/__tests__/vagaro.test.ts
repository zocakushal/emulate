import { beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { Store, WebhookDispatcher } from "@internal/core";
import { vagaroPlugin } from "../index.js";

const base = "http://localhost:4000";

function createTestApp() {
  const store = new Store();
  const webhooks = new WebhookDispatcher();
  const app = new Hono();
  vagaroPlugin.register(app as any, store, webhooks, base, new Map());
  vagaroPlugin.seed?.(store, base);
  return { app };
}

async function issueAccessToken(app: Hono): Promise<string> {
  const res = await app.request(`${base}/us04/api/v2/merchants/generate-access-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId: "test-client",
      clientSecretKey: "test-secret",
    }),
  });

  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: { access_token: string } };
  expect(body.data.access_token).toBeTruthy();
  return body.data.access_token;
}

describe("Vagaro plugin integration", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp().app;
  });

  it("issues an access token", async () => {
    const accessToken = await issueAccessToken(app);
    expect(accessToken).toContain("mock_vagaro_jwt");
  });

  it("lists services with accessToken header", async () => {
    const accessToken = await issueAccessToken(app);

    const res = await app.request(`${base}/us04/api/v2/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accessToken,
      },
      body: JSON.stringify({ businessId: "BIZ001" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { services: Array<{ serviceTitle: string }> } };
    expect(body.data.services[0]?.serviceTitle).toBe("Haircut");
  });

  it("lists appointments and availability", async () => {
    const accessToken = await issueAccessToken(app);

    const appointmentsRes = await app.request(`${base}/us04/api/v2/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accessToken,
      },
      body: JSON.stringify({ customerId: "FM1R4gT8OoDnqSAIK5jTtQ==" }),
    });
    expect(appointmentsRes.status).toBe(200);
    const appointmentsBody = (await appointmentsRes.json()) as {
      data: Array<{ appointmentId: string; customerId: string }>;
    };
    expect(appointmentsBody.data[0]?.customerId).toBe("FM1R4gT8OoDnqSAIK5jTtQ==");

    const availabilityRes = await app.request(`${base}/us04/api/v2/appointments/availability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accessToken,
      },
      body: JSON.stringify({ appointmentDate: "2026-05-01" }),
    });
    expect(availabilityRes.status).toBe(200);
    const availabilityBody = (await availabilityRes.json()) as {
      data: Array<{ date: string; slots: Array<{ time: string }> }>;
    };
    expect(availabilityBody.data[0]?.date).toBe("2026-05-01");
    expect(availabilityBody.data[0]?.slots.length).toBeGreaterThan(0);
  });

  it("lists employees and locations", async () => {
    const accessToken = await issueAccessToken(app);

    const employeesRes = await app.request(`${base}/us04/api/v2/employees`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accessToken,
      },
      body: JSON.stringify({ serviceProviderId: "EMP_mock_001" }),
    });
    expect(employeesRes.status).toBe(200);
    const employeesBody = (await employeesRes.json()) as {
      data: Array<{ serviceProviderId: string; firstName: string }>;
    };
    expect(employeesBody.data[0]?.serviceProviderId).toBe("EMP_mock_001");

    const locationsRes = await app.request(`${base}/us04/api/v2/locations`, {
      method: "POST",
      headers: {
        accessToken,
      },
    });
    expect(locationsRes.status).toBe(200);
    const locationsBody = (await locationsRes.json()) as {
      data: Array<{ locationName: string }>;
    };
    expect(locationsBody.data[0]?.locationName).toBe("Main Salon");
  });

  it("returns customers", async () => {
    const accessToken = await issueAccessToken(app);

    const res = await app.request(`${base}/us04/api/v2/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accessToken,
      },
      body: JSON.stringify({ customerId: "FM1R4gT8OoDnqSAIK5jTtQ==" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ customerId: string; firstName: string }> };
    expect(body.data[0]?.customerId).toBe("FM1R4gT8OoDnqSAIK5jTtQ==");
    expect(body.data[0]?.firstName).toBe("Jane");
  });

  it("creates, updates, and deletes personal tasks", async () => {
    const accessToken = await issueAccessToken(app);

    const createRes = await app.request(`${base}/us04/api/v2/personal-tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accessToken,
      },
      body: JSON.stringify({
        subject: "Vacation",
        description: "Out of office",
        startDate: "2026-05-01T09:00:00.000Z",
        endDate: "2026-05-01T11:00:00.000Z",
        serviceProviderId: "EMP_mock_001",
      }),
    });
    expect(createRes.status).toBe(200);
    const createBody = (await createRes.json()) as {
      data: { personalTimeOffId: string; status: string };
    };
    expect(createBody.data.status).toBe("success");

    const updateRes = await app.request(`${base}/us04/api/v2/personal-tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accessToken,
      },
      body: JSON.stringify({
        personalTimeOffId: createBody.data.personalTimeOffId,
        subject: "Updated Vacation",
        serviceProviderId: "EMP_mock_001",
      }),
    });
    expect(updateRes.status).toBe(200);
    const updateBody = (await updateRes.json()) as {
      data: { personalTimeOffId: string; status: string };
    };
    expect(updateBody.data.personalTimeOffId).toBe(createBody.data.personalTimeOffId);

    const deleteRes = await app.request(`${base}/us04/api/v2/personal-tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accessToken,
      },
      body: JSON.stringify({
        action: "delete",
        personalTimeOffId: createBody.data.personalTimeOffId,
      }),
    });
    expect(deleteRes.status).toBe(200);
    const deleteBody = (await deleteRes.json()) as {
      data: { personalTimeOffId: string; status: string };
    };
    expect(deleteBody.data.personalTimeOffId).toBe(createBody.data.personalTimeOffId);
    expect(deleteBody.data.status).toBe("success");
  });
});
