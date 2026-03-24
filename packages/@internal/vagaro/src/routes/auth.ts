import { parseJsonBody, type RouteContext } from "@internal/core";
import { generateId, getAccessTokens } from "../helpers.js";
import { getVagaroStore } from "../store.js";

export function authRoutes({ app, store }: RouteContext): void {
  const vs = getVagaroStore(store);

  app.post("/:region/api/v2/merchants/generate-access-token", async (c) => {
    const region = c.req.param("region");
    const body = await parseJsonBody(c);
    const clientId = typeof body.clientId === "string" ? body.clientId : "";
    const clientSecretKey = typeof body.clientSecretKey === "string" ? body.clientSecretKey : "";

    const business = vs.businesses
      .all()
      .find((item) => item.region === region && item.client_id === clientId && item.client_secret === clientSecretKey);

    if (!business) {
      return c.json({
        status: 401,
        responseCode: 4001,
        message: "Invalid client credentials",
        data: null,
      }, 401);
    }

    const accessToken = generateId("mock_vagaro_jwt");
    getAccessTokens(store).set(accessToken, {
      business_id: business.business_id,
      region,
      expires_at: Date.now() + 3600 * 1000,
    });

    return c.json({
      data: {
        access_token: accessToken,
        expires_in: 3600,
      },
    });
  });
}
