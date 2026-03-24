import { renderCardPage, renderErrorPage, renderUserButton, type RouteContext, bodyStr, matchesRedirectUri, parseJsonBody } from "@internal/core";
import { formatMerchant, generateId, getAccessTokens, getPendingCodes, getRefreshTokens, parseTokenBody, validateClient } from "../helpers.js";
import { getSquareStore } from "../store.js";

const SERVICE_LABEL = "Square";

export function oauthRoutes({ app, store }: RouteContext): void {
  const ss = getSquareStore(store);

  app.get("/oauth2/authorize", (c) => {
    const clientId = c.req.query("client_id") ?? "";
    const redirectUri = c.req.query("redirect_uri") ?? "";
    const state = c.req.query("state") ?? "";

    const client = ss.oauthClients.findOneBy("client_id", clientId);
    if (ss.oauthClients.all().length > 0) {
      if (!client) {
        return c.html(renderErrorPage("Application not found", `The client_id '${clientId}' is not registered.`, SERVICE_LABEL), 400);
      }
      if (redirectUri && !matchesRedirectUri(redirectUri, client.redirect_uris)) {
        return c.html(renderErrorPage("Redirect URI mismatch", "The redirect_uri is not registered for this application.", SERVICE_LABEL), 400);
      }
    }

    const merchants = ss.merchants.all();
    const body = merchants
      .map((merchant) =>
        renderUserButton({
          letter: (merchant.name[0] ?? "S").toUpperCase(),
          login: merchant.name,
          name: merchant.name,
          email: merchant.merchant_id,
          formAction: "/oauth2/authorize/callback",
          hiddenFields: {
            merchant_id: merchant.merchant_id,
            client_id: clientId,
            redirect_uri: redirectUri,
            state,
          },
        })
      )
      .join("\n");

    return c.html(renderCardPage("Sign in to Square", "Choose a seeded merchant account to continue.", body, SERVICE_LABEL));
  });

  app.post("/oauth2/authorize/callback", async (c) => {
    const body = await c.req.parseBody();
    const merchantId = bodyStr(body.merchant_id);
    const clientId = bodyStr(body.client_id);
    const redirectUri = bodyStr(body.redirect_uri);
    const state = bodyStr(body.state);
    const merchant = ss.merchants.findOneBy("merchant_id", merchantId);

    if (!merchant) {
      return c.html(renderErrorPage("Merchant not found", "The selected merchant no longer exists.", SERVICE_LABEL), 400);
    }

    const code = generateId("sq_code");
    getPendingCodes(store).set(code, {
      merchant_id: merchant.merchant_id,
      client_id: clientId,
      redirect_uri: redirectUri,
      created_at: Date.now(),
    });

    const url = new URL(redirectUri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);
    return c.redirect(url.toString(), 302);
  });

  app.post("/oauth2/token", async (c) => {
    const raw = await parseJsonBody(c);
    const body = parseTokenBody(raw);
    const client = ss.oauthClients.findOneBy("client_id", body.clientId);

    if (ss.oauthClients.all().length > 0 && !validateClient(client, body.clientSecret)) {
      return c.json({ errors: [{ code: "UNAUTHORIZED", detail: "Invalid client credentials" }] }, 401);
    }

    let merchantId: string | null = null;
    if (body.grantType === "authorization_code") {
      const pending = getPendingCodes(store).get(body.code);
      if (!pending || pending.client_id !== body.clientId || pending.redirect_uri !== body.redirectUri) {
        return c.json({ errors: [{ code: "INVALID_GRANT", detail: "Invalid authorization code" }] }, 400);
      }
      merchantId = pending.merchant_id;
      getPendingCodes(store).delete(body.code);
    } else if (body.grantType === "refresh_token") {
      const refreshRecord = getRefreshTokens(store).get(body.refreshToken);
      if (!refreshRecord) {
        return c.json({ errors: [{ code: "INVALID_GRANT", detail: "Invalid refresh token" }] }, 400);
      }
      merchantId = refreshRecord.merchant_id;
    } else {
      return c.json({ errors: [{ code: "UNSUPPORTED_GRANT_TYPE", detail: "Unsupported grant type" }] }, 400);
    }

    const accessToken = generateId("sq_access");
    const refreshToken = generateId("sq_refresh");
    getAccessTokens(store).set(accessToken, {
      merchant_id: merchantId!,
      client_id: body.clientId,
      created_at: Date.now(),
    });
    getRefreshTokens(store).set(refreshToken, {
      merchant_id: merchantId!,
      client_id: body.clientId,
      created_at: Date.now(),
    });

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    return c.json({
      access_token: accessToken,
      token_type: "bearer",
      expires_at: expiresAt,
      merchant_id: merchantId,
      refresh_token: refreshToken,
      accessToken,
      tokenType: "bearer",
      expiresAt,
      merchantId,
      refreshToken,
    });
  });

  app.post("/oauth2/revoke", async (c) => {
    const body = await parseJsonBody(c);
    const accessToken = bodyStr(body.access_token ?? body.accessToken);
    const refreshToken = bodyStr(body.refresh_token ?? body.refreshToken);
    if (accessToken) getAccessTokens(store).delete(accessToken);
    if (refreshToken) getRefreshTokens(store).delete(refreshToken);
    return c.json({ success: true });
  });
}
