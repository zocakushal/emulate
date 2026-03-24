import type { Entity } from "@internal/core";

export interface GlossgeniusBusiness extends Entity {
  slug: string;
  name: string;
  access_token: string;
  booking_url: string;
}

export interface GlossgeniusService extends Entity {
  business_slug: string;
  guid: string;
  token: string;
  name: string;
  description: string;
  price: string;
  duration: number;
  category_name: string;
  image: string | null;
  online_bookable: boolean;
  provider_guid: string | null;
}

export interface GlossgeniusProvider extends Entity {
  business_slug: string;
  guid: string;
  token: string;
  name: string;
  email: string | null;
  color: string | null;
  bio: string | null;
}

export interface GlossgeniusReview extends Entity {
  business_slug: string;
  rating: number;
  message: string;
  reviewer_name: string;
  published_at: string;
}

export interface GlossgeniusPortfolioImage extends Entity {
  business_slug: string;
  guid: string;
  url: string;
  caption: string | null;
}

export interface GlossgeniusAppointment extends Entity {
  business_slug: string;
  guid: string;
  appointment_token: string;
  provider_guid: string;
  client_id: number;
  client_name: string;
  client_email: string | null;
  client_phone: string;
  start_time: string;
  end_time: string;
  total_price: string;
  status: string;
  service_guids: string[];
}
