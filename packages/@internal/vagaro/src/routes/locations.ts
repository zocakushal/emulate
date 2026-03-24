import type { RouteContext } from "@internal/core";
import { envelope, formatLocation, requireBusiness } from "../helpers.js";
import { getVagaroStore } from "../store.js";

export function locationsRoutes({ app, store }: RouteContext): void {
  const vs = getVagaroStore(store);

  app.post("/:region/api/v2/locations", (c) => {
    const region = c.req.param("region");
    const business = requireBusiness(c, store, region);
    if (business instanceof Response) return business;

    const locations = vs.locations
      .all()
      .filter((location) => location.business_id === business.business_id)
      .map(formatLocation);

    return c.json(envelope(locations));
  });
}
