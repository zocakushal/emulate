import type { RouteContext } from "@internal/core";
import { formatMerchant, requireMerchant } from "../helpers.js";
import { getSquareStore } from "../store.js";

export function merchantsRoutes({ app, store }: RouteContext): void {
  const ss = getSquareStore(store);

  app.get("/v2/merchants/:id", (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const requested = ss.merchants.findOneBy("merchant_id", c.req.param("id"));
    if (!requested) {
      return c.json({ errors: [{ code: "NOT_FOUND", detail: "Merchant not found" }] }, 404);
    }
    return c.json({ merchant: formatMerchant(requested) });
  });
}
