import type { Entity } from "@internal/core";

export interface VagaroBusiness extends Entity {
  business_id: string;
  region: string;
  client_id: string;
  client_secret: string;
  name: string;
}

export interface VagaroService extends Entity {
  business_id: string;
  service_id: string;
  parent_service_id: string;
  parent_service_title: string;
  service_title: string;
  business_cost: number;
  currency: string;
  clean_up_time_minutes: number;
  duration_minutes: number;
  service_provider_ids: string[];
}

export interface VagaroEmployee extends Entity {
  business_id: string;
  service_provider_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  title: string;
}

export interface VagaroLocation extends Entity {
  business_id: string;
  location_id: string;
  location_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export interface VagaroCustomer extends Entity {
  business_id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface VagaroAppointment extends Entity {
  business_id: string;
  appointment_id: string;
  start_time: string;
  end_time: string;
  booking_status: string;
  service_title: string;
  service_id: string;
  amount: number;
  customer_id: string;
  service_provider_id: string;
}

export interface VagaroPersonalTask extends Entity {
  business_id: string;
  personal_time_off_id: string;
  subject: string;
  description: string;
  start_date: string;
  end_date: string;
  service_provider_id: string;
}
