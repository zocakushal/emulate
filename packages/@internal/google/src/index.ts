import type { Hono } from "hono";
import type { ServicePlugin, Store, WebhookDispatcher, TokenMap, AppEnv, RouteContext } from "@internal/core";
import { getGoogleStore } from "./store.js";
import { generateUid } from "./helpers.js";
import { oauthRoutes } from "./routes/oauth.js";
import { gbpRoutes } from "./routes/gbp.js";
import { mapsRoutes } from "./routes/maps.js";
import type { GbpVerificationState } from "./entities.js";

export { getGoogleStore, type GoogleStore } from "./store.js";
export * from "./entities.js";

export interface GbpAccountSeed {
  account_id: string;
  account_name?: string;
  type?: "PERSONAL" | "LOCATION_GROUP" | "ORGANIZATION";
}

export interface GbpLocationSeed {
  location_id: string;
  account_id: string;
  title: string;
  verification_state?: GbpVerificationState;
  has_voice_of_merchant?: boolean;
  has_business_authority?: boolean;
  store_code?: string;
  language_code?: string;
  phone_numbers?: { primaryPhone?: string; additionalPhones?: string[] };
  categories?: { primaryCategory?: { name: string; displayName?: string }; additionalCategories?: Array<{ name: string; displayName?: string }> };
  storefront_address?: {
    regionCode?: string;
    languageCode?: string;
    postalCode?: string;
    administrativeArea?: string;
    locality?: string;
    addressLines?: string[];
  };
  website_uri?: string;
  labels?: string[];
  latlng?: { latitude: number; longitude: number };
  open_info?: { status?: "OPEN" | "CLOSED_PERMANENTLY" | "CLOSED_TEMPORARILY" };
  profile?: { description?: string };
}

export interface GoogleSeedConfig {
  port?: number;
  users?: Array<{
    email: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    locale?: string;
  }>;
  oauth_clients?: Array<{
    client_id: string;
    client_secret: string;
    name: string;
    redirect_uris: string[];
  }>;
  gbp?: {
    accounts?: GbpAccountSeed[];
    locations?: GbpLocationSeed[];
  };
}

function seedDefaults(store: Store, _baseUrl: string): void {
  const gs = getGoogleStore(store);

  gs.users.insert({
    uid: generateUid("goog"),
    email: "testuser@gmail.com",
    name: "Test User",
    given_name: "Test",
    family_name: "User",
    picture: null,
    email_verified: true,
    locale: "en",
  });

  // Default GBP fixtures: one verified + one unverified location under a sample account
  gs.gbpAccounts.insert({
    account_id: "1234567890",
    name: "accounts/1234567890",
    account_name: "Sample Business Account",
    type: "LOCATION_GROUP",
  });

  gs.gbpLocations.insert({
    location_id: "1111111111",
    account_id: "1234567890",
    name: "locations/1111111111",
    title: "Verified Cafe",
    store_code: "STORE-1",
    language_code: "en",
    phone_numbers: { primaryPhone: "+1 415 555 0100" },
    categories: { primaryCategory: { name: "categories/gcid:cafe", displayName: "Cafe" } },
    storefront_address: { regionCode: "US", languageCode: "en", postalCode: "94103", administrativeArea: "CA", locality: "San Francisco", addressLines: ["100 Main St"] },
    website_uri: "https://verified-cafe.example",
    regular_hours: null,
    special_hours: null,
    service_area: null,
    labels: ["flagship"],
    latlng: { latitude: 37.7749, longitude: -122.4194 },
    open_info: { status: "OPEN", canReopen: true },
    metadata: { hasGoogleUpdated: false, canDelete: true },
    profile: { description: "A verified sample cafe." },
    relationship_data: null,
    more_hours: null,
    service_items: null,
    ad_words_location_extensions: null,
    verification_state: "COMPLETED",
    has_voice_of_merchant: true,
    has_business_authority: true,
  });

  gs.gbpLocations.insert({
    location_id: "2222222222",
    account_id: "1234567890",
    name: "locations/2222222222",
    title: "Unverified Cafe",
    store_code: "STORE-2",
    language_code: "en",
    phone_numbers: { primaryPhone: "+1 415 555 0200" },
    categories: { primaryCategory: { name: "categories/gcid:cafe", displayName: "Cafe" } },
    storefront_address: { regionCode: "US", languageCode: "en", postalCode: "94110", administrativeArea: "CA", locality: "San Francisco", addressLines: ["200 Market St"] },
    website_uri: null,
    regular_hours: null,
    special_hours: null,
    service_area: null,
    labels: null,
    latlng: { latitude: 37.76, longitude: -122.43 },
    open_info: { status: "OPEN", canReopen: true },
    metadata: { hasGoogleUpdated: false, canDelete: true },
    profile: null,
    relationship_data: null,
    more_hours: null,
    service_items: null,
    ad_words_location_extensions: null,
    verification_state: "UNVERIFIED",
    has_voice_of_merchant: false,
    has_business_authority: false,
  });
}

export function seedFromConfig(store: Store, _baseUrl: string, config: GoogleSeedConfig): void {
  const gs = getGoogleStore(store);

  if (config.users) {
    for (const u of config.users) {
      const existing = gs.users.findOneBy("email", u.email);
      if (existing) continue;

      const nameParts = (u.name ?? "").split(/\s+/);
      gs.users.insert({
        uid: generateUid("goog"),
        email: u.email,
        name: u.name ?? u.email.split("@")[0],
        given_name: u.given_name ?? nameParts[0] ?? "",
        family_name: u.family_name ?? nameParts.slice(1).join(" ") ?? "",
        picture: u.picture ?? null,
        email_verified: true,
        locale: u.locale ?? "en",
      });
    }
  }

  if (config.oauth_clients) {
    for (const client of config.oauth_clients) {
      const existing = gs.oauthClients.findOneBy("client_id", client.client_id);
      if (existing) continue;
      gs.oauthClients.insert({
        client_id: client.client_id,
        client_secret: client.client_secret,
        name: client.name,
        redirect_uris: client.redirect_uris,
      });
    }
  }

  if (config.gbp?.accounts) {
    for (const a of config.gbp.accounts) {
      if (gs.gbpAccounts.findOneBy("account_id", a.account_id)) continue;
      gs.gbpAccounts.insert({
        account_id: a.account_id,
        name: `accounts/${a.account_id}`,
        account_name: a.account_name ?? `Account ${a.account_id}`,
        type: a.type ?? "LOCATION_GROUP",
      });
    }
  }

  if (config.gbp?.locations) {
    for (const l of config.gbp.locations) {
      if (gs.gbpLocations.findOneBy("location_id", l.location_id)) continue;
      const verification = l.verification_state ?? "UNVERIFIED";
      gs.gbpLocations.insert({
        location_id: l.location_id,
        account_id: l.account_id,
        name: `locations/${l.location_id}`,
        title: l.title,
        store_code: l.store_code ?? null,
        language_code: l.language_code ?? "en",
        phone_numbers: l.phone_numbers ?? null,
        categories: l.categories ?? null,
        storefront_address: l.storefront_address ?? null,
        website_uri: l.website_uri ?? null,
        regular_hours: null,
        special_hours: null,
        service_area: null,
        labels: l.labels ?? null,
        latlng: l.latlng ?? null,
        open_info: l.open_info ?? { status: "OPEN" },
        metadata: { hasGoogleUpdated: false, canDelete: true },
        profile: l.profile ?? null,
        relationship_data: null,
        more_hours: null,
        service_items: null,
        ad_words_location_extensions: null,
        verification_state: verification,
        has_voice_of_merchant: l.has_voice_of_merchant ?? (verification === "COMPLETED"),
        has_business_authority: l.has_business_authority ?? (verification === "COMPLETED"),
      });
    }
  }
}

export const googlePlugin: ServicePlugin = {
  name: "google",
  register(app: Hono<AppEnv>, store: Store, webhooks: WebhookDispatcher, baseUrl: string, tokenMap?: TokenMap): void {
    const ctx: RouteContext = { app, store, webhooks, baseUrl, tokenMap };
    oauthRoutes(ctx);
    gbpRoutes(ctx);
    mapsRoutes(ctx);
  },
  seed(store: Store, baseUrl: string): void {
    seedDefaults(store, baseUrl);
  },
};

export default googlePlugin;
