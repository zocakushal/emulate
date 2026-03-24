import { parseJsonBody, type RouteContext } from "@internal/core";
import { generateToken, requireSite } from "../helpers.js";
import { getMindbodyStore } from "../store.js";

export function authRoutes({ app, store }: RouteContext): void {
  const ms = getMindbodyStore(store);

  app.post("/public/v6/usertoken/issue", async (c) => {
    const auth = requireSite(c, store, false);
    if (auth instanceof Response) return auth;
    await parseJsonBody(c);

    const token = ms.userTokens.insert({
      site_id: auth.site.site_id,
      access_token: generateToken("mindbody_access"),
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      renew_count: 0,
    });

    return c.json({
      TokenType: "Bearer",
      AccessToken: token.access_token,
      Expires: token.expires,
    });
  });

  app.post("/public/v6/usertoken/renew", (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const updated = ms.userTokens.update(auth.token!.id, {
      access_token: generateToken("mindbody_access"),
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      renew_count: auth.token!.renew_count + 1,
    });

    return c.json({
      AccessToken: updated!.access_token,
      Expiration: updated!.expires,
    });
  });
}
