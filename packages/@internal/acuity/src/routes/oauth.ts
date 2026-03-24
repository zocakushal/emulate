import { renderCardPage, renderErrorPage, renderUserButton, type RouteContext, bodyStr, matchesRedirectUri } from "@internal/core";
import {
  bodyStringField,
  formatOwner,
  generateToken,
  getAccessTokens,
  getPendingCodes,
  parseTokenBody,
  validateOAuthClient,
} from "../helpers.js";
import { getAcuityStore } from "../store.js";

const SERVICE_LABEL = "Acuity";

export function oauthRoutes({ app, store }: RouteContext): void {
  const as = getAcuityStore(store);

  app.get("/oauth2/authorize", (c) => {
    const clientId = c.req.query("client_id") ?? "";
    const redirectUri = c.req.query("redirect_uri") ?? "";
    const state = c.req.query("state") ?? "";
    const scope = c.req.query("scope") ?? "api-v1";

    const clientsConfigured = as.oauthClients.all().length > 0;
    let clientName = "";
    if (clientsConfigured) {
      const client = as.oauthClients.findOneBy("client_id", clientId);
      if (!client) {
        return c.html(renderErrorPage("Application not found", `The client_id '${clientId}' is not registered.`, SERVICE_LABEL), 400);
      }
      if (redirectUri && !matchesRedirectUri(redirectUri, client.redirect_uris)) {
        return c.html(renderErrorPage("Redirect URI mismatch", "The redirect_uri is not registered for this application.", SERVICE_LABEL), 400);
      }
      clientName = client.name;
    }

    const owners = as.owners.all();
    const subtitle = clientName
      ? `Sign in to <strong>${clientName}</strong> with a seeded Acuity owner account.`
      : "Choose a seeded owner account to continue.";
    const body = owners
      .map((owner) =>
        renderUserButton({
          letter: (owner.name[0] ?? "A").toUpperCase(),
          login: owner.email,
          name: owner.name,
          email: owner.email,
          formAction: "/oauth2/authorize/callback",
          hiddenFields: {
            owner_id: String(owner.id),
            client_id: clientId,
            redirect_uri: redirectUri,
            state,
            scope,
          },
        })
      )
      .join("\n");

    return c.html(renderCardPage("Sign in to Acuity", subtitle, body, SERVICE_LABEL));
  });

  app.post("/oauth2/authorize/callback", async (c) => {
    const body = await c.req.parseBody();
    const ownerId = Number(bodyStr(body.owner_id));
    const clientId = bodyStr(body.client_id);
    const redirectUri = bodyStr(body.redirect_uri);
    const state = bodyStr(body.state);
    const scope = bodyStr(body.scope) || "api-v1";
    const owner = as.owners.get(ownerId);

    if (!owner) {
      return c.html(renderErrorPage("Owner not found", "The selected owner account no longer exists.", SERVICE_LABEL), 400);
    }

    const code = generateToken("acuity_code");
    getPendingCodes(store).set(code, {
      owner_id: owner.id,
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      created_at: Date.now(),
    });

    const url = new URL(redirectUri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);
    return c.redirect(url.toString(), 302);
  });

  app.post("/oauth2/token", async (c) => {
    const body = await parseTokenBody(c);
    const grantType = bodyStringField(body.grant_type);
    const code = bodyStringField(body.code);
    const redirectUri = bodyStringField(body.redirect_uri);
    const clientId = bodyStringField(body.client_id);
    const clientSecret = bodyStringField(body.client_secret);

    if (grantType !== "authorization_code") {
      return c.json({ error: "unsupported_grant_type" }, 400);
    }

    const client = as.oauthClients.findOneBy("client_id", clientId);
    if (as.oauthClients.all().length > 0 && !validateOAuthClient(client, clientSecret)) {
      return c.json({ error: "invalid_client" }, 401);
    }

    const pending = getPendingCodes(store).get(code);
    if (!pending || pending.redirect_uri !== redirectUri || pending.client_id !== clientId || Date.now() - pending.created_at > 10 * 60 * 1000) {
      return c.json({ error: "invalid_grant" }, 400);
    }

    getPendingCodes(store).delete(code);

    const accessToken = generateToken("acuity_access");
    const refreshToken = generateToken("acuity_refresh");
    getAccessTokens(store).set(accessToken, {
      owner_id: pending.owner_id,
      client_id: pending.client_id,
      created_at: Date.now(),
    });

    const owner = as.owners.get(pending.owner_id)!;
    return c.json({
      access_token: accessToken,
      token_type: "bearer",
      refresh_token: refreshToken,
      scope: pending.scope,
      expires_in: 3600,
      owner: formatOwner(owner),
    });
  });
}
