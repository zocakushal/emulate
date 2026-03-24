import { beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { authMiddleware, Store, type TokenMap, WebhookDispatcher } from "@internal/core";
import { seedFromConfig, squarePlugin } from "../index.js";

const base = "http://localhost:4000";
const authHeaders = {
  Authorization: "Bearer test-token",
};

function createTestApp() {
  const store = new Store();
  const webhooks = new WebhookDispatcher();
  const tokenMap: TokenMap = new Map();
  tokenMap.set("test-token", {
    login: "merchant@example.com",
    id: 1,
    scopes: ["appointments:read"],
  });

  const app = new Hono();
  app.use("*", authMiddleware(tokenMap, undefined, { login: "merchant@example.com", id: 1, scopes: ["appointments:read"] }));
  squarePlugin.register(app as any, store, webhooks, base, tokenMap);
  squarePlugin.seed?.(store, base);
  seedFromConfig(store, base, {
    oauth_clients: [
      {
        client_id: "sq0idp-test",
        client_secret: "sq0csp-test",
        redirect_uris: ["http://localhost:3000/callback"],
      },
    ],
  });
  return { app, store };
}

async function issueOAuthCode(app: Hono): Promise<string> {
  const authorizeRes = await app.request(
    `${base}/oauth2/authorize?client_id=sq0idp-test&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&state=square-state`
  );
  expect(authorizeRes.status).toBe(200);
  const authorizeHtml = await authorizeRes.text();
  expect(authorizeHtml).toContain("Sign in to Square");

  const callbackRes = await app.request(`${base}/oauth2/authorize/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      merchant_id: "MERCHANT_001",
      client_id: "sq0idp-test",
      redirect_uri: "http://localhost:3000/callback",
      state: "square-state",
    }).toString(),
    redirect: "manual",
  });

  expect(callbackRes.status).toBe(302);
  const location = callbackRes.headers.get("location");
  expect(location).toBeTruthy();
  expect(new URL(location!).searchParams.get("state")).toBe("square-state");

  const code = new URL(location!).searchParams.get("code");
  expect(code).toBeTruthy();
  return code!;
}

async function exchangeAuthorizationCode(app: Hono, code: string) {
  const tokenRes = await app.request(`${base}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: "sq0idp-test",
      client_secret: "sq0csp-test",
      code,
      redirect_uri: "http://localhost:3000/callback",
    }),
  });

  expect(tokenRes.status).toBe(200);
  return (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    merchant_id: string;
  };
}

describe("Square plugin integration", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp().app;
  });

  it("covers the OAuth authorize and authorization_code token flow", async () => {
    const code = await issueOAuthCode(app);
    const tokenBody = await exchangeAuthorizationCode(app, code);
    expect(tokenBody.access_token).toBeTruthy();
    expect(tokenBody.refresh_token).toBeTruthy();
    expect(tokenBody.merchant_id).toBe("MERCHANT_001");
  });

  it("covers the refresh_token and revoke flows", async () => {
    const code = await issueOAuthCode(app);
    const initialTokenBody = await exchangeAuthorizationCode(app, code);

    const refreshRes = await app.request(`${base}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: "sq0idp-test",
        client_secret: "sq0csp-test",
        refresh_token: initialTokenBody.refresh_token,
      }),
    });
    expect(refreshRes.status).toBe(200);
    const refreshBody = (await refreshRes.json()) as { access_token: string; refresh_token: string };
    expect(refreshBody.access_token).toBeTruthy();

    const revokeRes = await app.request(`${base}/oauth2/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: refreshBody.access_token,
        refresh_token: refreshBody.refresh_token,
      }),
    });
    expect(revokeRes.status).toBe(200);
    const revokeBody = (await revokeRes.json()) as { success: boolean };
    expect(revokeBody.success).toBe(true);

    const revokedRefreshRes = await app.request(`${base}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: "sq0idp-test",
        client_secret: "sq0csp-test",
        refresh_token: refreshBody.refresh_token,
      }),
    });
    expect(revokedRefreshRes.status).toBe(400);
    const revokedRefreshBody = (await revokedRefreshRes.json()) as {
      errors: Array<{ code: string }>;
    };
    expect(revokedRefreshBody.errors[0]?.code).toBe("INVALID_GRANT");
  });

  it("creates, fetches, lists, and cancels bookings", async () => {
    const createRes = await app.request(`${base}/v2/bookings`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        booking: {
          location_id: "LOC_mock_location_001",
          customer_id: "CUST_mock_customer_001",
          start_at: "2026-05-01T10:00:00.000Z",
          appointment_segments: [
            {
              service_variation_id: "SV_mock_service_001",
              service_variation_version: 1,
              team_member_id: "TM_mock_team_001",
              duration_minutes: 30,
            },
          ],
        },
      }),
    });
    expect(createRes.status).toBe(200);
    const createBody = (await createRes.json()) as { booking: { id: string; location_id: string } };
    expect(createBody.booking.location_id).toBe("LOC_mock_location_001");

    const getRes = await app.request(`${base}/v2/bookings/${createBody.booking.id}`, {
      headers: authHeaders,
    });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { booking: { id: string } };
    expect(getBody.booking.id).toBe(createBody.booking.id);

    const listRes = await app.request(
      `${base}/v2/bookings?customer_id=CUST_mock_customer_001&location_id=LOC_mock_location_001`,
      {
        headers: authHeaders,
      }
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { bookings: Array<{ id: string }> };
    expect(listBody.bookings.some((booking) => booking.id === createBody.booking.id)).toBe(true);

    const cancelRes = await app.request(`${base}/v2/bookings/${createBody.booking.id}/cancel`, {
      method: "POST",
      headers: authHeaders,
    });
    expect(cancelRes.status).toBe(200);
    const cancelBody = (await cancelRes.json()) as { booking: { status: string } };
    expect(cancelBody.booking.status).toBe("CANCELLED_BY_SELLER");
  });

  it("searches availability through both booking endpoints", async () => {
    const payload = JSON.stringify({
      query: {
        filter: {
          start_at_range: {
            start_at: "2026-05-01T09:00:00.000Z",
            end_at: "2026-05-01T12:00:00.000Z",
          },
          location_id: "LOC_mock_location_001",
          segment_filters: [
            {
              service_variation_id: "SV_mock_service_001",
              service_variation_version: 1,
            },
          ],
        },
      },
    });

    const searchRes = await app.request(`${base}/v2/bookings/search/availability`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: payload,
    });
    expect(searchRes.status).toBe(200);
    const searchBody = (await searchRes.json()) as { availabilities: Array<{ location_id: string }> };
    expect(searchBody.availabilities[0]?.location_id).toBe("LOC_mock_location_001");

    const aliasRes = await app.request(`${base}/v2/bookings/availability/search`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: payload,
    });
    expect(aliasRes.status).toBe(200);
    const aliasBody = (await aliasRes.json()) as { availabilities: Array<{ location_id: string }> };
    expect(aliasBody.availabilities[0]?.location_id).toBe("LOC_mock_location_001");
  });

  it("searches, lists, and fetches catalog objects", async () => {
    const searchRes = await app.request(`${base}/v2/catalog/search`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          text_query: {
            keywords: ["hair"],
          },
        },
      }),
    });
    expect(searchRes.status).toBe(200);
    const searchBody = (await searchRes.json()) as { objects: Array<{ id: string }> };
    expect(searchBody.objects[0]?.id).toBe("ITEM_mock_service_001");

    const listRes = await app.request(`${base}/v2/catalog/list?types=CATEGORY,ITEM`, {
      headers: authHeaders,
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { objects: Array<{ type: string }> };
    expect(listBody.objects.some((object) => object.type === "CATEGORY")).toBe(true);
    expect(listBody.objects.some((object) => object.type === "ITEM")).toBe(true);

    const itemRes = await app.request(`${base}/v2/catalog/object/ITEM_mock_service_001`, {
      headers: authHeaders,
    });
    expect(itemRes.status).toBe(200);
    const itemBody = (await itemRes.json()) as { object: { id: string } };
    expect(itemBody.object.id).toBe("ITEM_mock_service_001");

    const variationRes = await app.request(`${base}/v2/catalog/object/SV_mock_service_001`, {
      headers: authHeaders,
    });
    expect(variationRes.status).toBe(200);
    const variationBody = (await variationRes.json()) as { object: { id: string } };
    expect(variationBody.object.id).toBe("SV_mock_service_001");
  });

  it("searches and fetches team members", async () => {
    const searchRes = await app.request(`${base}/v2/team-members/search`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          filter: {
            status: "ACTIVE",
          },
        },
      }),
    });
    expect(searchRes.status).toBe(200);
    const searchBody = (await searchRes.json()) as { team_members: Array<{ id: string }> };
    expect(searchBody.team_members[0]?.id).toBe("TM_mock_team_001");

    const getRes = await app.request(`${base}/v2/team-members/TM_mock_team_001`, {
      headers: authHeaders,
    });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { team_member: { id: string } };
    expect(getBody.team_member.id).toBe("TM_mock_team_001");
  });

  it("searches, creates, and fetches customers", async () => {
    const searchRes = await app.request(`${base}/v2/customers/search`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          filter: {
            email_address: {
              exact: "john@example.com",
            },
          },
        },
      }),
    });
    expect(searchRes.status).toBe(200);
    const searchBody = (await searchRes.json()) as { customers: Array<{ id: string }> };
    expect(searchBody.customers[0]?.id).toBe("CUST_mock_customer_001");

    const createRes = await app.request(`${base}/v2/customers`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        given_name: "Alice",
        family_name: "Walker",
        email_address: "alice@example.com",
        phone_number: "+15550001111",
      }),
    });
    expect(createRes.status).toBe(200);
    const createBody = (await createRes.json()) as { customer: { id: string; given_name: string } };
    expect(createBody.customer.given_name).toBe("Alice");

    const getRes = await app.request(`${base}/v2/customers/${createBody.customer.id}`, {
      headers: authHeaders,
    });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { customer: { id: string; email_address: string } };
    expect(getBody.customer.id).toBe(createBody.customer.id);
    expect(getBody.customer.email_address).toBe("alice@example.com");
  });

  it("lists locations and returns merchant details", async () => {
    const locationsRes = await app.request(`${base}/v2/locations`, {
      headers: authHeaders,
    });
    expect(locationsRes.status).toBe(200);
    const locationsBody = (await locationsRes.json()) as { locations: Array<{ name: string }> };
    expect(locationsBody.locations[0]?.name).toBe("Main Location");

    const merchantRes = await app.request(`${base}/v2/merchants/MERCHANT_001`, {
      headers: authHeaders,
    });
    expect(merchantRes.status).toBe(200);
    const merchantBody = (await merchantRes.json()) as { merchant: { business_name: string } };
    expect(merchantBody.merchant.business_name).toBe("Test Business");
  });
});
