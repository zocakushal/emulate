import type { Context } from "hono";
import { Store, bodyStr, constantTimeSecretEqual } from "@internal/core";
import type {
  SquareAppointmentSegment,
  SquareBooking,
  SquareCatalogCategory,
  SquareCatalogItem,
  SquareCustomer,
  SquareLocation,
  SquareMerchant,
  SquareOAuthClient,
  SquareServiceVariation,
  SquareTeamMember,
} from "./entities.js";
import { getSquareStore } from "./store.js";

type PendingCode = {
  merchant_id: string;
  client_id: string;
  redirect_uri: string;
  created_at: number;
};

type TokenRecord = {
  merchant_id: string;
  client_id: string;
  created_at: number;
};

export function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 18)}`;
}

export function getPendingCodes(store: Store): Map<string, PendingCode> {
  let codes = store.getData<Map<string, PendingCode>>("square.oauth.pendingCodes");
  if (!codes) {
    codes = new Map();
    store.setData("square.oauth.pendingCodes", codes);
  }
  return codes;
}

export function getAccessTokens(store: Store): Map<string, TokenRecord> {
  let tokens = store.getData<Map<string, TokenRecord>>("square.oauth.accessTokens");
  if (!tokens) {
    tokens = new Map();
    store.setData("square.oauth.accessTokens", tokens);
  }
  return tokens;
}

export function getRefreshTokens(store: Store): Map<string, TokenRecord> {
  let tokens = store.getData<Map<string, TokenRecord>>("square.oauth.refreshTokens");
  if (!tokens) {
    tokens = new Map();
    store.setData("square.oauth.refreshTokens", tokens);
  }
  return tokens;
}

export function parseBearer(c: Context): string | null {
  const auth = c.req.header("Authorization");
  if (!auth) return null;
  return auth.replace(/^Bearer\s+/i, "").trim() || null;
}

export function resolveMerchant(c: Context, store: Store): SquareMerchant | null {
  const ss = getSquareStore(store);
  const token = parseBearer(c);
  if (token) {
    const record = getAccessTokens(store).get(token);
    if (record) {
      return ss.merchants.findOneBy("merchant_id", record.merchant_id) ?? null;
    }
  }
  if (c.get("authUser")) {
    return ss.merchants.all()[0] ?? null;
  }
  return null;
}

export function requireMerchant(c: Context, store: Store): SquareMerchant | Response | null {
  const merchant = resolveMerchant(c, store);
  if (!merchant) {
    return c.json({ errors: [{ code: "UNAUTHORIZED", detail: "Requires authentication" }] }, 401);
  }
  return merchant;
}

export function parseTokenBody(raw: Record<string, unknown>) {
  return {
    clientId: bodyStr(raw.client_id ?? raw.clientId),
    clientSecret: bodyStr(raw.client_secret ?? raw.clientSecret),
    code: bodyStr(raw.code),
    redirectUri: bodyStr(raw.redirect_uri ?? raw.redirectUri),
    refreshToken: bodyStr(raw.refresh_token ?? raw.refreshToken),
    grantType: bodyStr(raw.grant_type ?? raw.grantType),
  };
}

export function validateClient(client: SquareOAuthClient | undefined, secret: string): client is SquareOAuthClient {
  if (!client) return false;
  return constantTimeSecretEqual(secret, client.client_secret);
}

export function formatMerchant(merchant: SquareMerchant) {
  return {
    id: merchant.merchant_id,
    business_name: merchant.name,
    country: merchant.country,
    currency: merchant.currency,
    status: merchant.status,
  };
}

export function formatLocation(location: SquareLocation) {
  return {
    id: location.location_id,
    merchant_id: location.merchant_id,
    name: location.name,
    status: location.status,
    timezone: location.timezone,
    country: location.country,
    address: {
      address_line_1: location.address,
      country: location.country,
    },
  };
}

export function formatCustomer(customer: SquareCustomer) {
  return {
    id: customer.customer_id,
    given_name: customer.given_name,
    family_name: customer.family_name,
    email_address: customer.email_address,
    phone_number: customer.phone_number,
    created_at: customer.created_at,
  };
}

export function formatTeamMember(member: SquareTeamMember) {
  return {
    id: member.team_member_id,
    given_name: member.given_name,
    family_name: member.family_name,
    email_address: member.email_address,
    phone_number: member.phone_number,
    status: member.status,
    is_owner: false,
  };
}

export function formatVariation(variation: SquareServiceVariation, item: SquareCatalogItem, merchant: SquareMerchant) {
  return {
    type: "ITEM_VARIATION",
    id: variation.variation_id,
    version: variation.version,
    item_variation_data: {
      item_id: item.item_id,
      name: variation.name,
      pricing_type: "FIXED_PRICING",
      price_money: {
        amount: variation.price,
        currency: merchant.currency,
      },
      service_duration: variation.duration * 60_000,
    },
  };
}

export function formatItem(
  item: SquareCatalogItem,
  category: SquareCatalogCategory | undefined,
  variations: SquareServiceVariation[],
  merchant: SquareMerchant,
) {
  return {
    type: "ITEM",
    id: item.item_id,
    item_data: {
      name: item.name,
      description: item.description,
      category_id: category?.category_id ?? item.category_id,
      variations: variations.map((variation) => formatVariation(variation, item, merchant)),
    },
  };
}

export function formatBooking(booking: SquareBooking) {
  return {
    id: booking.booking_id,
    version: booking.version,
    location_id: booking.location_id,
    customer_id: booking.customer_id,
    start_at: booking.start_at,
    status: booking.status,
    appointment_segments: booking.appointment_segments.map((segment) => ({
      service_variation_id: segment.service_variation_id,
      service_variation_version: segment.service_variation_version,
      team_member_id: segment.team_member_id,
      duration_minutes: segment.duration_minutes,
    })),
    customer_note: booking.customer_note,
    seller_note: booking.seller_note,
    created_at: booking.created_at,
    updated_at: booking.updated_at,
  };
}

export function buildAvailability(
  locationId: string,
  segments: SquareAppointmentSegment[],
  startAt: string,
) {
  const start = new Date(startAt);
  return [0, 30].map((offset) => ({
    start_at: new Date(start.getTime() + offset * 60_000).toISOString(),
    location_id: locationId,
    appointment_segments: segments.map((segment) => ({
      service_variation_id: segment.service_variation_id,
      service_variation_version: segment.service_variation_version,
      team_member_id: segment.team_member_id,
      duration_minutes: segment.duration_minutes,
      any_team_member: false,
    })),
  }));
}
