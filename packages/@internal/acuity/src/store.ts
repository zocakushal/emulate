import { Store, type Collection } from "@internal/core";
import type {
  AcuityAppointment,
  AcuityAppointmentType,
  AcuityCalendar,
  AcuityOAuthClient,
  AcuityOwner,
  AcuityPayment,
} from "./entities.js";

export interface AcuityStore {
  owners: Collection<AcuityOwner>;
  calendars: Collection<AcuityCalendar>;
  appointmentTypes: Collection<AcuityAppointmentType>;
  appointments: Collection<AcuityAppointment>;
  payments: Collection<AcuityPayment>;
  oauthClients: Collection<AcuityOAuthClient>;
}

export function getAcuityStore(store: Store): AcuityStore {
  return {
    owners: store.collection<AcuityOwner>("acuity.owners", ["owner_key", "email"]),
    calendars: store.collection<AcuityCalendar>("acuity.calendars", ["external_id", "owner_id", "location"]),
    appointmentTypes: store.collection<AcuityAppointmentType>("acuity.appointment_types", ["external_id", "owner_id", "name"]),
    appointments: store.collection<AcuityAppointment>("acuity.appointments", ["external_id", "owner_id", "appointment_type_id", "calendar_id", "email"]),
    payments: store.collection<AcuityPayment>("acuity.payments", ["appointment_id", "transaction_id"]),
    oauthClients: store.collection<AcuityOAuthClient>("acuity.oauth_clients", ["client_id"]),
  };
}
