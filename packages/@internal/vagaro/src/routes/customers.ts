import { parseJsonBody, type RouteContext } from "@internal/core";
import { envelope, formatCustomer, requireBusiness } from "../helpers.js";
import { getVagaroStore } from "../store.js";

export function customersRoutes({ app, store }: RouteContext): void {
  const vs = getVagaroStore(store);

  app.post("/:region/api/v2/customers", async (c) => {
    const region = c.req.param("region");
    const business = requireBusiness(c, store, region);
    if (business instanceof Response) return business;

    const body = await parseJsonBody(c);
    const customerId = typeof body.customerId === "string" ? body.customerId : undefined;

    const customers = vs.customers
      .all()
      .filter((customer) => customer.business_id === business.business_id)
      .filter((customer) => !customerId || customer.customer_id === customerId)
      .map(formatCustomer);

    return c.json(envelope(customers));
  });
}
