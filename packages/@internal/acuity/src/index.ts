import type { Hono } from "hono";
import type { AppEnv, RouteContext, ServicePlugin, Store, TokenMap, WebhookDispatcher } from "@internal/core";
import { generateOwnerKey } from "./helpers.js";
import { getAcuityStore } from "./store.js";
import { oauthRoutes } from "./routes/oauth.js";
import { calendarsRoutes } from "./routes/calendars.js";
import { availabilityRoutes } from "./routes/availability.js";
import { appointmentsRoutes } from "./routes/appointments.js";

export { getAcuityStore, type AcuityStore } from "./store.js";
export * from "./entities.js";

export interface AcuitySeedConfig {
  port?: number;
  oauth_clients?: Array<{
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    name?: string;
  }>;
  owners?: Array<{
    name: string;
    email: string;
    currency?: string;
  }>;
  calendars?: Array<{
    name: string;
    location: string;
    timezone: string;
    email?: string;
    description?: string;
  }>;
  appointment_types?: Array<{
    name: string;
    duration: number;
    price: string;
    category: string;
    description?: string;
    calendar_ids?: number[];
  }>;
}

function seedDefaults(store: Store, _baseUrl: string): void {
  const as = getAcuityStore(store);
  const owner = as.owners.insert({
    owner_key: generateOwnerKey(),
    name: "Test Owner",
    email: "owner@example.com",
    currency: "USD",
    created: new Date().toISOString(),
  });

  const calendar = as.calendars.insert({
    owner_id: owner.id,
    external_id: 1,
    name: "Main Calendar",
    email: owner.email,
    reply_to: owner.email,
    description: "Main studio calendar",
    location: "Downtown Studio",
    timezone: "America/New_York",
    thumbnail: null,
    image: null,
    is_valid: true,
  });

  const appointmentType = as.appointmentTypes.insert({
    owner_id: owner.id,
    external_id: 1,
    active: true,
    name: "Consultation",
    description: "Initial consultation",
    duration: 60,
    price: "100.00",
    image: null,
    category: "Services",
    color: "#111111",
    private: false,
    type: "regular",
    class_size: "1",
    padding_after: 0,
    padding_before: 0,
    calendar_ids: [calendar.external_id],
    addon_ids: [],
    form_ids: [],
    scheduling_url: "https://app.acuityscheduling.com/schedule/demo",
  });

  const startTime = new Date();
  startTime.setUTCDate(startTime.getUTCDate() + 1);
  startTime.setUTCHours(14, 0, 0, 0);

  const appointment = as.appointments.insert({
    owner_id: owner.id,
    external_id: 2001,
    appointment_type_id: appointmentType.external_id,
    calendar_id: calendar.external_id,
    datetime: startTime.toISOString(),
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    phone: "+15551234567",
    amount_paid: appointmentType.price,
    scheduled_by: "Seed",
    location: calendar.location,
    canceled: false,
  });

  as.payments.insert({
    appointment_id: appointment.external_id,
    status: "paid",
    amount: appointmentType.price,
    currency: owner.currency,
    transaction_id: `pay_${appointment.external_id}`,
  });
}

export function seedFromConfig(store: Store, _baseUrl: string, config: AcuitySeedConfig): void {
  const as = getAcuityStore(store);

  if (config.oauth_clients) {
    for (const client of config.oauth_clients) {
      if (as.oauthClients.findOneBy("client_id", client.client_id)) continue;
      as.oauthClients.insert({
        client_id: client.client_id,
        client_secret: client.client_secret,
        name: client.name ?? client.client_id,
        redirect_uris: client.redirect_uris,
      });
    }
  }

  if (config.owners) {
    for (const owner of config.owners) {
      const existing = as.owners.findOneBy("email", owner.email);
      if (existing) continue;
      as.owners.insert({
        owner_key: generateOwnerKey(),
        name: owner.name,
        email: owner.email,
        currency: owner.currency ?? "USD",
        created: new Date().toISOString(),
      });
    }
  }

  const owner = as.owners.all()[0];
  if (!owner) return;

  if (config.calendars) {
    for (const calendar of config.calendars) {
      const existing = as.calendars
        .all()
        .find((item) => item.owner_id === owner.id && item.name === calendar.name);
      if (existing) continue;
      as.calendars.insert({
        owner_id: owner.id,
        external_id: as.calendars.count() + 1,
        name: calendar.name,
        email: calendar.email ?? owner.email,
        reply_to: calendar.email ?? owner.email,
        description: calendar.description ?? "",
        location: calendar.location,
        timezone: calendar.timezone,
        thumbnail: null,
        image: null,
        is_valid: true,
      });
    }
  }

  if (config.appointment_types) {
    const calendars = as.calendars.all().filter((calendar) => calendar.owner_id === owner.id);
    for (const type of config.appointment_types) {
      const existing = as.appointmentTypes
        .all()
        .find((item) => item.owner_id === owner.id && item.name === type.name);
      if (existing) continue;
      as.appointmentTypes.insert({
        owner_id: owner.id,
        external_id: as.appointmentTypes.count() + 1,
        active: true,
        name: type.name,
        description: type.description ?? "",
        duration: type.duration,
        price: type.price,
        image: null,
        category: type.category,
        color: "#111111",
        private: false,
        type: "regular",
        class_size: "1",
        padding_after: 0,
        padding_before: 0,
        calendar_ids: type.calendar_ids ?? calendars.map((calendar) => calendar.external_id),
        addon_ids: [],
        form_ids: [],
        scheduling_url: "https://app.acuityscheduling.com/schedule/demo",
      });
    }
  }
}

export const acuityPlugin: ServicePlugin = {
  name: "acuity",
  register(app: Hono<AppEnv>, store: Store, webhooks: WebhookDispatcher, baseUrl: string, tokenMap?: TokenMap): void {
    const ctx: RouteContext = { app, store, webhooks, baseUrl, tokenMap };
    oauthRoutes(ctx);
    calendarsRoutes(ctx);
    availabilityRoutes(ctx);
    appointmentsRoutes(ctx);
  },
  seed(store: Store, baseUrl: string): void {
    seedDefaults(store, baseUrl);
  },
};

export default acuityPlugin;
