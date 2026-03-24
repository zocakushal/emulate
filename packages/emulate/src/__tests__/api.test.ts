import { describe, it, expect } from "vitest";
import { createEmulator } from "../api.js";

describe("createEmulator", () => {
  it("starts github and returns a url", async () => {
    const github = await createEmulator({ service: "github", port: 14000 });

    expect(github.url).toBe("http://localhost:14000");

    const res = await fetch(`${github.url}/user`, {
      headers: { Authorization: "token gho_test_token_admin" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { login: string };
    expect(body.login).toBe("admin");

    await github.close();
  });

  it("starts multiple services independently", async () => {
    const [github, vercel] = await Promise.all([
      createEmulator({ service: "github", port: 14010 }),
      createEmulator({ service: "vercel", port: 14011 }),
    ]);

    expect(github.url).toBe("http://localhost:14010");
    expect(vercel.url).toBe("http://localhost:14011");

    await Promise.all([github.close(), vercel.close()]);
  });

  it("reset wipes and re-seeds stores", async () => {
    const github = await createEmulator({
      service: "github",
      port: 14020,
      seed: { github: { users: [{ login: "test-user" }] } },
    });

    const createRes = await fetch(`${github.url}/user/repos`, {
      method: "POST",
      headers: {
        Authorization: "token gho_test_token_admin",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "my-repo", private: false }),
    });
    expect(createRes.status).toBe(201);

    github.reset();

    const listRes = await fetch(`${github.url}/user/repos`, {
      headers: { Authorization: "token gho_test_token_admin" },
    });
    expect(listRes.status).toBe(200);
    const repos = (await listRes.json()) as unknown[];
    expect(repos).toHaveLength(0);

    await github.close();
  });

  it("starts glossgenius and serves public booking data", async () => {
    const glossgenius = await createEmulator({ service: "glossgenius", port: 14030 });

    const res = await fetch(`${glossgenius.url}/v3/web/reviews?slug=test-salon`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ reviewer_name: string }> };
    expect(body.data[0]?.reviewer_name).toBe("Happy Client");

    await glossgenius.close();
  });

  it("starts acuity and returns owner details", async () => {
    const acuity = await createEmulator({ service: "acuity", port: 14031 });

    const res = await fetch(`${acuity.url}/api/v1/me`, {
      headers: { Authorization: "Bearer gho_test_token_admin" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { displayName: string };
    expect(body.displayName).toBe("Test Owner");

    await acuity.close();
  });

  it("starts vagaro and issues access tokens", async () => {
    const vagaro = await createEmulator({ service: "vagaro", port: 14032 });

    const res = await fetch(`${vagaro.url}/us04/api/v2/merchants/generate-access-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "test-client",
        clientSecretKey: "test-secret",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { access_token: string } };
    expect(body.data.access_token).toBeTruthy();

    await vagaro.close();
  });

  it("starts mindbody and issues user tokens", async () => {
    const mindbody = await createEmulator({ service: "mindbody", port: 14033 });

    const res = await fetch(`${mindbody.url}/public/v6/usertoken/issue`, {
      method: "POST",
      headers: {
        "Api-Key": "test-api-key",
        SiteId: "123456",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { AccessToken: string };
    expect(body.AccessToken).toBeTruthy();

    await mindbody.close();
  });

  it("starts square and lists locations", async () => {
    const square = await createEmulator({ service: "square", port: 14034 });

    const res = await fetch(`${square.url}/v2/locations`, {
      headers: { Authorization: "Bearer gho_test_token_admin" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { locations: Array<{ name: string }> };
    expect(body.locations[0]?.name).toBe("Main Location");

    await square.close();
  });

  it("throws on unknown service", async () => {
    // @ts-expect-error testing invalid service name
    await expect(createEmulator({ service: "unknown-svc" })).rejects.toThrow("Unknown service");
  });
});
