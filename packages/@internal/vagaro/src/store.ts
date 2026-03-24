import { Store, type Collection } from "@internal/core";
import type {
  VagaroAppointment,
  VagaroBusiness,
  VagaroCustomer,
  VagaroEmployee,
  VagaroLocation,
  VagaroPersonalTask,
  VagaroService,
} from "./entities.js";

export interface VagaroStore {
  businesses: Collection<VagaroBusiness>;
  services: Collection<VagaroService>;
  employees: Collection<VagaroEmployee>;
  locations: Collection<VagaroLocation>;
  customers: Collection<VagaroCustomer>;
  appointments: Collection<VagaroAppointment>;
  personalTasks: Collection<VagaroPersonalTask>;
}

export function getVagaroStore(store: Store): VagaroStore {
  return {
    businesses: store.collection<VagaroBusiness>("vagaro.businesses", ["business_id", "region", "client_id"]),
    services: store.collection<VagaroService>("vagaro.services", ["business_id", "service_id"]),
    employees: store.collection<VagaroEmployee>("vagaro.employees", ["business_id", "service_provider_id"]),
    locations: store.collection<VagaroLocation>("vagaro.locations", ["business_id", "location_id"]),
    customers: store.collection<VagaroCustomer>("vagaro.customers", ["business_id", "customer_id", "email"]),
    appointments: store.collection<VagaroAppointment>("vagaro.appointments", ["business_id", "appointment_id", "customer_id"]),
    personalTasks: store.collection<VagaroPersonalTask>("vagaro.personal_tasks", ["business_id", "personal_time_off_id"]),
  };
}
