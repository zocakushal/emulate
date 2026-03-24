import { parseJsonBody, type RouteContext } from "@internal/core";
import { envelope, formatEmployee, requireBusiness } from "../helpers.js";
import { getVagaroStore } from "../store.js";

export function employeesRoutes({ app, store }: RouteContext): void {
  const vs = getVagaroStore(store);

  app.post("/:region/api/v2/employees", async (c) => {
    const region = c.req.param("region");
    const business = requireBusiness(c, store, region);
    if (business instanceof Response) return business;

    const body = await parseJsonBody(c);
    const serviceProviderId = typeof body.serviceProviderId === "string" ? body.serviceProviderId : undefined;

    const employees = vs.employees
      .all()
      .filter((employee) => employee.business_id === business.business_id)
      .filter((employee) => !serviceProviderId || employee.service_provider_id === serviceProviderId)
      .map(formatEmployee);

    return c.json(envelope(employees));
  });
}
