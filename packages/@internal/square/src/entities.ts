import type { Entity } from "@internal/core";

export interface SquareMerchant extends Entity {
  merchant_id: string;
  name: string;
  currency: string;
  country: string;
  status: string;
}

export interface SquareLocation extends Entity {
  location_id: string;
  merchant_id: string;
  name: string;
  address: string;
  timezone: string;
  country: string;
  status: string;
}

export interface SquareCustomer extends Entity {
  customer_id: string;
  merchant_id: string;
  given_name: string;
  family_name: string;
  email_address: string | null;
  phone_number: string | null;
}

export interface SquareCatalogCategory extends Entity {
  category_id: string;
  merchant_id: string;
  name: string;
}

export interface SquareCatalogItem extends Entity {
  item_id: string;
  merchant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
}

export interface SquareServiceVariation extends Entity {
  variation_id: string;
  merchant_id: string;
  item_id: string;
  name: string;
  price: number;
  duration: number;
  version: number;
}

export interface SquareTeamMember extends Entity {
  team_member_id: string;
  merchant_id: string;
  given_name: string;
  family_name: string;
  email_address: string | null;
  phone_number: string | null;
  status: string;
}

export interface SquareAppointmentSegment {
  service_variation_id: string;
  service_variation_version: number;
  team_member_id: string;
  duration_minutes: number;
}

export interface SquareBooking extends Entity {
  booking_id: string;
  merchant_id: string;
  location_id: string;
  customer_id: string;
  start_at: string;
  status: string;
  version: number;
  customer_note: string | null;
  seller_note: string | null;
  appointment_segments: SquareAppointmentSegment[];
}

export interface SquareOAuthClient extends Entity {
  client_id: string;
  client_secret: string;
  name: string;
  redirect_uris: string[];
}
