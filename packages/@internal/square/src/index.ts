import type { Hono } from "hono";
import type { AppEnv, RouteContext, ServicePlugin, Store, TokenMap, WebhookDispatcher } from "@internal/core";
import { generateId } from "./helpers.js";
import { getSquareStore } from "./store.js";
import { oauthRoutes } from "./routes/oauth.js";
import { bookingsRoutes } from "./routes/bookings.js";
import { catalogRoutes } from "./routes/catalog.js";
import { teamMembersRoutes } from "./routes/team-members.js";
import { customersRoutes } from "./routes/customers.js";
import { locationsRoutes } from "./routes/locations.js";
import { merchantsRoutes } from "./routes/merchants.js";

export { getSquareStore, type SquareStore } from "./store.js";
export * from "./entities.js";

export interface SquareSeedConfig {
  port?: number;
  oauth_clients?: Array<{
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    name?: string;
  }>;
  merchants?: Array<{
    merchant_id?: string;
    name: string;
    currency?: string;
    country?: string;
  }>;
  locations?: Array<{
    merchant_id?: string;
    name: string;
    address: string;
    timezone: string;
    country?: string;
  }>;
  catalog_items?: Array<{
    merchant_id?: string;
    name: string;
    category?: string;
    variations: Array<{
      name: string;
      price: number;
      duration: number;
    }>;
  }>;
  team_members?: Array<{
    merchant_id?: string;
    given_name: string;
    family_name: string;
    status?: string;
    email_address?: string;
    phone_number?: string;
  }>;
  customers?: Array<{
    merchant_id?: string;
    given_name: string;
    family_name: string;
    email: string;
    phone: string;
  }>;
}

function ensureCategory(store: ReturnType<typeof getSquareStore>, merchantId: string, name: string) {
  return (
    store.catalogCategories
      .all()
      .find((category) => category.merchant_id === merchantId && category.name === name) ??
    store.catalogCategories.insert({
      category_id: `CAT_${Math.random().toString(36).slice(2, 12)}`,
      merchant_id: merchantId,
      name,
    })
  );
}

function seedDefaults(store: Store, _baseUrl: string): void {
  const ss = getSquareStore(store);
  const merchant = ss.merchants.insert({
    merchant_id: "MERCHANT_001",
    name: "Test Business",
    currency: "USD",
    country: "US",
    status: "ACTIVE",
  });

  const category = ensureCategory(ss, merchant.merchant_id, "Services");

  const location = ss.locations.insert({
    location_id: "LOC_mock_location_001",
    merchant_id: merchant.merchant_id,
    name: "Main Location",
    address: "123 Main St",
    timezone: "America/New_York",
    country: "US",
    status: "ACTIVE",
  });

  const item = ss.catalogItems.insert({
    item_id: "ITEM_mock_service_001",
    merchant_id: merchant.merchant_id,
    category_id: category.category_id,
    name: "Haircut",
    description: "Classic haircut",
  });

  const variation = ss.serviceVariations.insert({
    variation_id: "SV_mock_service_001",
    merchant_id: merchant.merchant_id,
    item_id: item.item_id,
    name: "Standard",
    price: 4000,
    duration: 30,
    version: 1,
  });

  const teamMember = ss.teamMembers.insert({
    team_member_id: "TM_mock_team_001",
    merchant_id: merchant.merchant_id,
    given_name: "Jane",
    family_name: "Stylist",
    email_address: "jane@salon.com",
    phone_number: "+15559999999",
    status: "ACTIVE",
  });

  const customer = ss.customers.insert({
    customer_id: "CUST_mock_customer_001",
    merchant_id: merchant.merchant_id,
    given_name: "John",
    family_name: "Doe",
    email_address: "john@example.com",
    phone_number: "+15551234567",
  });

  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(10, 0, 0, 0);

  ss.bookings.insert({
    booking_id: "BKG_mock_booking_001",
    merchant_id: merchant.merchant_id,
    location_id: location.location_id,
    customer_id: customer.customer_id,
    start_at: start.toISOString(),
    status: "ACCEPTED",
    version: 1,
    customer_note: "Mock booking",
    seller_note: null,
    appointment_segments: [
      {
        service_variation_id: variation.variation_id,
        service_variation_version: variation.version,
        team_member_id: teamMember.team_member_id,
        duration_minutes: variation.duration,
      },
    ],
  });
}

export function seedFromConfig(store: Store, _baseUrl: string, config: SquareSeedConfig): void {
  const ss = getSquareStore(store);

  if (config.oauth_clients) {
    for (const client of config.oauth_clients) {
      if (ss.oauthClients.findOneBy("client_id", client.client_id)) continue;
      ss.oauthClients.insert({
        client_id: client.client_id,
        client_secret: client.client_secret,
        name: client.name ?? client.client_id,
        redirect_uris: client.redirect_uris,
      });
    }
  }

  if (config.merchants) {
    for (const merchant of config.merchants) {
      ss.merchants.insert({
        merchant_id: merchant.merchant_id ?? `MERCHANT_${Math.random().toString(36).slice(2, 10)}`,
        name: merchant.name,
        currency: merchant.currency ?? "USD",
        country: merchant.country ?? "US",
        status: "ACTIVE",
      });
    }
  }

  const defaultMerchant = ss.merchants.all()[0];
  if (!defaultMerchant) return;

  if (config.locations) {
    for (const location of config.locations) {
      const merchantId = location.merchant_id ?? defaultMerchant.merchant_id;
      ss.locations.insert({
        location_id: `LOC_${Math.random().toString(36).slice(2, 10)}`,
        merchant_id: merchantId,
        name: location.name,
        address: location.address,
        timezone: location.timezone,
        country: location.country ?? "US",
        status: "ACTIVE",
      });
    }
  }

  if (config.catalog_items) {
    for (const catalogItem of config.catalog_items) {
      const merchantId = catalogItem.merchant_id ?? defaultMerchant.merchant_id;
      const category = ensureCategory(ss, merchantId, catalogItem.category ?? "Services");
      const item = ss.catalogItems.insert({
        item_id: `ITEM_${Math.random().toString(36).slice(2, 10)}`,
        merchant_id: merchantId,
        category_id: category.category_id,
        name: catalogItem.name,
        description: null,
      });
      for (const variation of catalogItem.variations) {
        ss.serviceVariations.insert({
          variation_id: `SV_${Math.random().toString(36).slice(2, 10)}`,
          merchant_id: merchantId,
          item_id: item.item_id,
          name: variation.name,
          price: variation.price,
          duration: variation.duration,
          version: 1,
        });
      }
    }
  }

  if (config.team_members) {
    for (const member of config.team_members) {
      ss.teamMembers.insert({
        team_member_id: `TM_${Math.random().toString(36).slice(2, 10)}`,
        merchant_id: member.merchant_id ?? defaultMerchant.merchant_id,
        given_name: member.given_name,
        family_name: member.family_name,
        email_address: member.email_address ?? null,
        phone_number: member.phone_number ?? null,
        status: member.status ?? "ACTIVE",
      });
    }
  }

  if (config.customers) {
    for (const customer of config.customers) {
      ss.customers.insert({
        customer_id: `CUST_${Math.random().toString(36).slice(2, 10)}`,
        merchant_id: customer.merchant_id ?? defaultMerchant.merchant_id,
        given_name: customer.given_name,
        family_name: customer.family_name,
        email_address: customer.email,
        phone_number: customer.phone,
      });
    }
  }
}

export const squarePlugin: ServicePlugin = {
  name: "square",
  register(app: Hono<AppEnv>, store: Store, webhooks: WebhookDispatcher, baseUrl: string, tokenMap?: TokenMap): void {
    const ctx: RouteContext = { app, store, webhooks, baseUrl, tokenMap };
    oauthRoutes(ctx);
    bookingsRoutes(ctx);
    catalogRoutes(ctx);
    teamMembersRoutes(ctx);
    customersRoutes(ctx);
    locationsRoutes(ctx);
    merchantsRoutes(ctx);
  },
  seed(store: Store, baseUrl: string): void {
    seedDefaults(store, baseUrl);
  },
};

export default squarePlugin;
