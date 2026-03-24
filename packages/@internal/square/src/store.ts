import { Store, type Collection } from "@internal/core";
import type {
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

export interface SquareStore {
  merchants: Collection<SquareMerchant>;
  locations: Collection<SquareLocation>;
  customers: Collection<SquareCustomer>;
  catalogItems: Collection<SquareCatalogItem>;
  catalogCategories: Collection<SquareCatalogCategory>;
  serviceVariations: Collection<SquareServiceVariation>;
  teamMembers: Collection<SquareTeamMember>;
  bookings: Collection<SquareBooking>;
  oauthClients: Collection<SquareOAuthClient>;
}

export function getSquareStore(store: Store): SquareStore {
  return {
    merchants: store.collection<SquareMerchant>("square.merchants", ["merchant_id", "name"]),
    locations: store.collection<SquareLocation>("square.locations", ["location_id", "merchant_id"]),
    customers: store.collection<SquareCustomer>("square.customers", ["customer_id", "merchant_id", "email_address", "phone_number"]),
    catalogItems: store.collection<SquareCatalogItem>("square.catalog_items", ["item_id", "merchant_id", "name"]),
    catalogCategories: store.collection<SquareCatalogCategory>("square.catalog_categories", ["category_id", "merchant_id", "name"]),
    serviceVariations: store.collection<SquareServiceVariation>("square.service_variations", ["variation_id", "merchant_id", "item_id", "name"]),
    teamMembers: store.collection<SquareTeamMember>("square.team_members", ["team_member_id", "merchant_id", "status"]),
    bookings: store.collection<SquareBooking>("square.bookings", ["booking_id", "merchant_id", "location_id", "customer_id"]),
    oauthClients: store.collection<SquareOAuthClient>("square.oauth_clients", ["client_id"]),
  };
}
