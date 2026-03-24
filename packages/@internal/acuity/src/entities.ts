import type { Entity } from "@internal/core";

export interface AcuityOwner extends Entity {
  owner_key: string;
  name: string;
  email: string;
  currency: string;
  created: string;
}

export interface AcuityCalendar extends Entity {
  owner_id: number;
  external_id: number;
  name: string;
  email: string;
  reply_to: string;
  description: string;
  location: string;
  timezone: string;
  thumbnail: string | null;
  image: string | null;
  is_valid: boolean;
}

export interface AcuityAppointmentType extends Entity {
  owner_id: number;
  external_id: number;
  active: boolean;
  name: string;
  description: string;
  duration: number;
  price: string;
  image: string | null;
  category: string;
  color: string;
  private: boolean;
  type: string;
  class_size: string;
  padding_after: number;
  padding_before: number;
  calendar_ids: number[];
  addon_ids: number[];
  form_ids: number[];
  scheduling_url: string;
}

export interface AcuityAppointment extends Entity {
  owner_id: number;
  external_id: number;
  appointment_type_id: number;
  calendar_id: number;
  datetime: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  amount_paid: string;
  scheduled_by: string;
  location: string;
  canceled: boolean;
}

export interface AcuityPayment extends Entity {
  appointment_id: number;
  status: string;
  amount: string;
  currency: string;
  transaction_id: string;
}

export interface AcuityOAuthClient extends Entity {
  client_id: string;
  client_secret: string;
  name: string;
  redirect_uris: string[];
}
