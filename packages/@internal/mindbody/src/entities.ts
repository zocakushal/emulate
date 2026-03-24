import type { Entity } from "@internal/core";

export interface MindbodySite extends Entity {
  site_id: string;
  name: string;
  email: string;
  currency: string;
}

export interface MindbodyLocation extends Entity {
  site_id: string;
  location_id: number;
  name: string;
  address: string;
  address2: string;
  city: string;
  postal_code: string;
  phone: string;
  latitude: number;
  longitude: number;
}

export interface MindbodySessionType extends Entity {
  site_id: string;
  session_type_id: number;
  type: string;
  name: string;
  num_deducted: number;
  program_id: number;
  description: string;
  default_time_length: number;
  category: string;
}

export interface MindbodyProgram extends Entity {
  site_id: string;
  program_id: number;
  name: string;
  schedule_type: string;
  cancel_offset: number;
}

export interface MindbodyClient extends Entity {
  site_id: string;
  client_id: string;
  unique_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile_phone: string | null;
  home_phone: string | null;
  work_phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  birth_date: string | null;
  gender: string | null;
  is_prospect: boolean;
  status: string;
  creation_date: string;
  card_last_four: string | null;
  card_type: string | null;
}

export interface MindbodyAppointment extends Entity {
  site_id: string;
  appointment_id: number;
  client_id: string;
  location_id: number;
  session_type_id: number;
  staff_id: number;
  start_date_time: string;
  end_date_time: string;
  duration: number;
  status: string;
  notes: string;
  staff_first_name: string;
  staff_last_name: string;
}

export interface MindbodyUserToken extends Entity {
  site_id: string;
  access_token: string;
  expires: string;
  renew_count: number;
}
