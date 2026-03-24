import type { Hono } from "hono";
import type { AppEnv, RouteContext, ServicePlugin, Store, TokenMap, WebhookDispatcher } from "@internal/core";
import { generateId } from "./helpers.js";
import { getVagaroStore } from "./store.js";
import { authRoutes } from "./routes/auth.js";
import { servicesRoutes } from "./routes/services.js";
import { appointmentsRoutes } from "./routes/appointments.js";
import { employeesRoutes } from "./routes/employees.js";
import { locationsRoutes } from "./routes/locations.js";
import { customersRoutes } from "./routes/customers.js";
import { personalTasksRoutes } from "./routes/personal-tasks.js";

export { getVagaroStore, type VagaroStore } from "./store.js";
export * from "./entities.js";

export interface VagaroSeedConfig {
  port?: number;
  businesses?: Array<{
    business_id: string;
    region: string;
    client_id: string;
    client_secret: string;
    name?: string;
  }>;
  services?: Array<{
    name: string;
    duration: number;
    price: number;
    business_id: string;
  }>;
  employees?: Array<{
    name: string;
    business_id: string;
    email?: string;
    phone?: string;
    title?: string;
  }>;
  locations?: Array<{
    name: string;
    business_id: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  }>;
}

function seedDefaults(store: Store, _baseUrl: string): void {
  const vs = getVagaroStore(store);
  const business = vs.businesses.insert({
    business_id: "BIZ001",
    region: "us04",
    client_id: "test-client",
    client_secret: "test-secret",
    name: "Test Salon",
  });

  const employee = vs.employees.insert({
    business_id: business.business_id,
    service_provider_id: "EMP_mock_001",
    first_name: "Jane",
    last_name: "Stylist",
    email: "jane@salon.com",
    phone: "+15559999999",
    title: "Senior Stylist",
  });

  const secondEmployee = vs.employees.insert({
    business_id: business.business_id,
    service_provider_id: "EMP_mock_002",
    first_name: "Maria",
    last_name: "Colorist",
    email: "maria@salon.com",
    phone: "+15558888888",
    title: "Color Specialist",
  });

  vs.services.insert({
    business_id: business.business_id,
    service_id: "savf7ss7jeRPEn7gGQ==",
    parent_service_id: "savf7ss7jeRPEn7gGQ==",
    parent_service_title: "Haircuts and Other",
    service_title: "Haircut",
    business_cost: 40,
    currency: "USD",
    clean_up_time_minutes: 0,
    duration_minutes: 30,
    service_provider_ids: [employee.service_provider_id],
  });

  vs.services.insert({
    business_id: business.business_id,
    service_id: "tRfG8hj2klMN3pQrSt==",
    parent_service_id: "tRfG8hj2klMN3pQrSt==",
    parent_service_title: "Color Services",
    service_title: "Color Treatment",
    business_cost: 120,
    currency: "USD",
    clean_up_time_minutes: 10,
    duration_minutes: 60,
    service_provider_ids: [secondEmployee.service_provider_id],
  });

  vs.locations.insert({
    business_id: business.business_id,
    location_id: "LOC_mock_001",
    location_name: "Main Salon",
    address: "123 Main St",
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    phone: "+15551112222",
  });

  const customer = vs.customers.insert({
    business_id: business.business_id,
    customer_id: "FM1R4gT8OoDnqSAIK5jTtQ==",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane.doe@example.com",
    phone: "+15551234567",
  });

  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(10, 0, 0, 0);

  vs.appointments.insert({
    business_id: business.business_id,
    appointment_id: generateId("appt"),
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + 30 * 60_000).toISOString(),
    booking_status: "Confirmed",
    service_title: "Haircut",
    service_id: "savf7ss7jeRPEn7gGQ==",
    amount: 40,
    customer_id: customer.customer_id,
    service_provider_id: employee.service_provider_id,
  });
}

export function seedFromConfig(store: Store, _baseUrl: string, config: VagaroSeedConfig): void {
  const vs = getVagaroStore(store);

  if (config.businesses) {
    for (const business of config.businesses) {
      if (vs.businesses.findOneBy("business_id", business.business_id)) continue;
      vs.businesses.insert({
        business_id: business.business_id,
        region: business.region,
        client_id: business.client_id,
        client_secret: business.client_secret,
        name: business.name ?? business.business_id,
      });
    }
  }

  if (config.employees) {
    for (const employee of config.employees) {
      const [firstName, ...rest] = employee.name.split(/\s+/);
      const lastName = rest.join(" ") || "Staff";
      vs.employees.insert({
        business_id: employee.business_id,
        service_provider_id: generateId("EMP"),
        first_name: firstName || "Staff",
        last_name: lastName,
        email: employee.email ?? "staff@example.com",
        phone: employee.phone ?? "+15550000000",
        title: employee.title ?? "Staff",
      });
    }
  }

  if (config.services) {
    for (const service of config.services) {
      const providers = vs.employees
        .all()
        .filter((employee) => employee.business_id === service.business_id)
        .map((employee) => employee.service_provider_id);
      vs.services.insert({
        business_id: service.business_id,
        service_id: generateId("svc"),
        parent_service_id: generateId("parent"),
        parent_service_title: "Services",
        service_title: service.name,
        business_cost: service.price,
        currency: "USD",
        clean_up_time_minutes: 0,
        duration_minutes: service.duration,
        service_provider_ids: providers,
      });
    }
  }

  if (config.locations) {
    for (const location of config.locations) {
      vs.locations.insert({
        business_id: location.business_id,
        location_id: generateId("LOC"),
        location_name: location.name,
        address: location.address ?? "123 Main St",
        city: location.city ?? "Los Angeles",
        state: location.state ?? "CA",
        zip: location.zip ?? "90001",
        phone: location.phone ?? "+15551112222",
      });
    }
  }
}

export const vagaroPlugin: ServicePlugin = {
  name: "vagaro",
  register(app: Hono<AppEnv>, store: Store, webhooks: WebhookDispatcher, baseUrl: string, tokenMap?: TokenMap): void {
    const ctx: RouteContext = { app, store, webhooks, baseUrl, tokenMap };
    authRoutes(ctx);
    servicesRoutes(ctx);
    appointmentsRoutes(ctx);
    employeesRoutes(ctx);
    locationsRoutes(ctx);
    customersRoutes(ctx);
    personalTasksRoutes(ctx);
  },
  seed(store: Store, baseUrl: string): void {
    seedDefaults(store, baseUrl);
  },
};

export default vagaroPlugin;
