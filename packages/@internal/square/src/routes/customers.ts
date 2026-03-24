import { bodyStr, parseJsonBody, type RouteContext } from "@internal/core";
import { formatCustomer, generateId, requireMerchant } from "../helpers.js";
import { getSquareStore } from "../store.js";

export function customersRoutes({ app, store }: RouteContext): void {
  const ss = getSquareStore(store);

  app.post("/v2/customers/search", async (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const body = await parseJsonBody(c);
    const query = (body.query ?? {}) as Record<string, unknown>;
    const filter = (query.filter ?? {}) as Record<string, unknown>;

    const phone = bodyStr(((filter.phone_number ?? filter.phoneNumber ?? {}) as Record<string, unknown>).fuzzy);
    const email = bodyStr(((filter.email_address ?? filter.emailAddress ?? {}) as Record<string, unknown>).exact);

    const customers = ss.customers
      .all()
      .filter((customer) => customer.merchant_id === merchant.merchant_id)
      .filter((customer) => !phone || (customer.phone_number ?? "").includes(phone))
      .filter((customer) => !email || customer.email_address === email)
      .map(formatCustomer);

    return c.json({ customers });
  });

  app.post("/v2/customers", async (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const body = await parseJsonBody(c);
    const customer = ss.customers.insert({
      customer_id: `CUST_${Math.random().toString(36).slice(2, 14)}`,
      merchant_id: merchant.merchant_id,
      given_name: bodyStr(body.given_name ?? body.givenName) || "Customer",
      family_name: bodyStr(body.family_name ?? body.familyName) || "User",
      email_address: bodyStr(body.email_address ?? body.emailAddress) || null,
      phone_number: bodyStr(body.phone_number ?? body.phoneNumber) || null,
    });

    return c.json({ customer: formatCustomer(customer) });
  });

  app.get("/v2/customers/:id", (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const customer = ss.customers
      .all()
      .find((item) => item.merchant_id === merchant.merchant_id && item.customer_id === c.req.param("id"));
    if (!customer) {
      return c.json({ errors: [{ code: "NOT_FOUND", detail: "Customer not found" }] }, 404);
    }
    return c.json({ customer: formatCustomer(customer) });
  });
}
