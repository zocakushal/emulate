import type { RouteContext } from "@internal/core";
import { formatLocation, requireMerchant } from "../helpers.js";
import { getSquareStore } from "../store.js";

export function locationsRoutes({ app, store }: RouteContext): void {
  const ss = getSquareStore(store);

  app.get("/v2/locations", (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const locations = ss.locations
      .all()
      .filter((location) => location.merchant_id === merchant.merchant_id)
      .map(formatLocation);
    return c.json({ locations });
  });
}
