import type { Hono } from "hono";
import type { AppEnv, RouteContext, ServicePlugin, Store, TokenMap, WebhookDispatcher } from "@internal/core";
import { addMinutes, generateToken, setApiKey } from "./helpers.js";
import { getMindbodyStore } from "./store.js";
import { authRoutes } from "./routes/auth.js";
import { siteRoutes } from "./routes/site.js";
import { appointmentRoutes } from "./routes/appointment.js";
import { clientRoutes } from "./routes/client.js";

export { getMindbodyStore, type MindbodyStore } from "./store.js";
export * from "./entities.js";

export interface MindbodySeedConfig {
  port?: number;
  api_key?: string;
  sites?: Array<{
    site_id: string;
    name: string;
    email: string;
    currency?: string;
  }>;
  locations?: Array<{
    site_id: string;
    name: string;
    address: string;
  }>;
  session_types?: Array<{
    name: string;
    duration: number;
    price: number;
    program_id: number;
    site_id?: string;
    description?: string;
    category?: string;
  }>;
  programs?: Array<{
    site_id?: string;
    program_id: number;
    name: string;
    schedule_type?: string;
  }>;
  clients?: Array<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    site_id?: string;
  }>;
}

function seedDefaults(store: Store, _baseUrl: string): void {
  setApiKey(store, "test-api-key");
  const ms = getMindbodyStore(store);
  const site = ms.sites.insert({
    site_id: "123456",
    name: "Test Studio",
    email: "studio@example.com",
    currency: "USD",
  });

  ms.programs.insert({
    site_id: site.site_id,
    program_id: 1,
    name: "Hair Services",
    schedule_type: "Appointment",
    cancel_offset: 0,
  });

  const location = ms.locations.insert({
    site_id: site.site_id,
    location_id: 1,
    name: "Main Location",
    address: "123 Main St",
    address2: "",
    city: "Los Angeles",
    postal_code: "90001",
    phone: "+15551112222",
    latitude: 34.0522,
    longitude: -118.2437,
  });

  const sessionType = ms.sessionTypes.insert({
    site_id: site.site_id,
    session_type_id: 5001,
    type: "Appointment",
    name: "Haircut",
    num_deducted: 1,
    program_id: 1,
    description: "Standard haircut",
    default_time_length: 30,
    category: "Hair",
  });

  const client = ms.clients.insert({
    site_id: site.site_id,
    client_id: "100012345",
    unique_id: 12345,
    first_name: "John",
    last_name: "Doe",
    email: "john@example.com",
    mobile_phone: "+15551234567",
    home_phone: "",
    work_phone: "",
    address_line_1: "123 Main St",
    address_line_2: "",
    city: "Los Angeles",
    state: "CA",
    postal_code: "90001",
    country: "US",
    birth_date: null,
    gender: null,
    is_prospect: false,
    status: "Active",
    creation_date: new Date().toISOString(),
    card_last_four: null,
    card_type: null,
  });

  const token = ms.userTokens.insert({
    site_id: site.site_id,
    access_token: generateToken("mindbody_access"),
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    renew_count: 0,
  });
  void token;

  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(10, 0, 0, 0);

  ms.appointments.insert({
    site_id: site.site_id,
    appointment_id: 90001,
    client_id: client.client_id,
    location_id: location.location_id,
    session_type_id: sessionType.session_type_id,
    staff_id: 100000001,
    start_date_time: start.toISOString(),
    end_date_time: addMinutes(start.toISOString(), sessionType.default_time_length),
    duration: sessionType.default_time_length,
    status: "Booked",
    notes: "Seed appointment",
    staff_first_name: "Alex",
    staff_last_name: "Stylist",
  });
}

export function seedFromConfig(store: Store, _baseUrl: string, config: MindbodySeedConfig): void {
  const ms = getMindbodyStore(store);
  if (config.api_key) {
    setApiKey(store, config.api_key);
  }

  if (config.sites) {
    for (const site of config.sites) {
      if (ms.sites.findOneBy("site_id", site.site_id)) continue;
      ms.sites.insert({
        site_id: site.site_id,
        name: site.name,
        email: site.email,
        currency: site.currency ?? "USD",
      });
    }
  }

  const defaultSite = ms.sites.all()[0];
  if (!defaultSite) return;

  if (config.programs) {
    for (const program of config.programs) {
      ms.programs.insert({
        site_id: program.site_id ?? defaultSite.site_id,
        program_id: program.program_id,
        name: program.name,
        schedule_type: program.schedule_type ?? "Appointment",
        cancel_offset: 0,
      });
    }
  }

  if (config.locations) {
    for (const location of config.locations) {
      ms.locations.insert({
        site_id: location.site_id,
        location_id: ms.locations.count() + 1,
        name: location.name,
        address: location.address,
        address2: "",
        city: "Los Angeles",
        postal_code: "90001",
        phone: "+15551112222",
        latitude: 34.0522,
        longitude: -118.2437,
      });
    }
  }

  if (config.session_types) {
    for (const sessionType of config.session_types) {
      ms.sessionTypes.insert({
        site_id: sessionType.site_id ?? defaultSite.site_id,
        session_type_id: ms.sessionTypes.count() + 5001,
        type: "Appointment",
        name: sessionType.name,
        num_deducted: 1,
        program_id: sessionType.program_id,
        description: sessionType.description ?? "",
        default_time_length: sessionType.duration,
        category: sessionType.category ?? "Services",
      });
    }
  }

  if (config.clients) {
    for (const client of config.clients) {
      ms.clients.insert({
        site_id: client.site_id ?? defaultSite.site_id,
        client_id: String(100000000 + ms.clients.count() + 1),
        unique_id: 10000 + ms.clients.count() + 1,
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        mobile_phone: client.phone,
        home_phone: "",
        work_phone: "",
        address_line_1: null,
        address_line_2: null,
        city: null,
        state: null,
        postal_code: null,
        country: "US",
        birth_date: null,
        gender: null,
        is_prospect: false,
        status: "Active",
        creation_date: new Date().toISOString(),
        card_last_four: null,
        card_type: null,
      });
    }
  }

  for (const site of ms.sites.all()) {
    if (ms.userTokens.all().some((token) => token.site_id === site.site_id)) continue;
    ms.userTokens.insert({
      site_id: site.site_id,
      access_token: generateToken("mindbody_access"),
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      renew_count: 0,
    });
  }
}

export const mindbodyPlugin: ServicePlugin = {
  name: "mindbody",
  register(app: Hono<AppEnv>, store: Store, webhooks: WebhookDispatcher, baseUrl: string, tokenMap?: TokenMap): void {
    const ctx: RouteContext = { app, store, webhooks, baseUrl, tokenMap };
    authRoutes(ctx);
    siteRoutes(ctx);
    appointmentRoutes(ctx);
    clientRoutes(ctx);
  },
  seed(store: Store, baseUrl: string): void {
    seedDefaults(store, baseUrl);
  },
};

export default mindbodyPlugin;
