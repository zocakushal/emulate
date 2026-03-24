import { parseJsonBody, type RouteContext } from "@internal/core";
import { envelope, formatService, requireBusiness } from "../helpers.js";
import { getVagaroStore } from "../store.js";

export function servicesRoutes({ app, store }: RouteContext): void {
  const vs = getVagaroStore(store);

  app.post("/:region/api/v2/services", async (c) => {
    const region = c.req.param("region");
    const business = requireBusiness(c, store, region);
    if (business instanceof Response) return business;

    const body = await parseJsonBody(c);
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : undefined;
    const services = vs.services
      .all()
      .filter((service) => service.business_id === business.business_id)
      .filter((service) => !serviceId || service.service_id === serviceId)
      .map((service) => {
        const employees = vs.employees
          .all()
          .filter((employee) => service.service_provider_ids.includes(employee.service_provider_id));
        return formatService(service, employees);
      });

    return c.json(envelope({ services, nextPage: null }));
  });
}
