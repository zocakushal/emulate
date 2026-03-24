import { Store, type Collection } from "@internal/core";
import type {
  MindbodyAppointment,
  MindbodyClient,
  MindbodyLocation,
  MindbodyProgram,
  MindbodySessionType,
  MindbodySite,
  MindbodyUserToken,
} from "./entities.js";

export interface MindbodyStore {
  sites: Collection<MindbodySite>;
  locations: Collection<MindbodyLocation>;
  sessionTypes: Collection<MindbodySessionType>;
  programs: Collection<MindbodyProgram>;
  clients: Collection<MindbodyClient>;
  appointments: Collection<MindbodyAppointment>;
  userTokens: Collection<MindbodyUserToken>;
}

export function getMindbodyStore(store: Store): MindbodyStore {
  return {
    sites: store.collection<MindbodySite>("mindbody.sites", ["site_id", "email"]),
    locations: store.collection<MindbodyLocation>("mindbody.locations", ["site_id", "location_id"]),
    sessionTypes: store.collection<MindbodySessionType>("mindbody.session_types", ["site_id", "session_type_id", "program_id"]),
    programs: store.collection<MindbodyProgram>("mindbody.programs", ["site_id", "program_id"]),
    clients: store.collection<MindbodyClient>("mindbody.clients", ["site_id", "client_id", "email", "mobile_phone"]),
    appointments: store.collection<MindbodyAppointment>("mindbody.appointments", ["site_id", "appointment_id", "client_id", "location_id"]),
    userTokens: store.collection<MindbodyUserToken>("mindbody.user_tokens", ["site_id", "access_token"]),
  };
}
