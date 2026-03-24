import type { Context } from "hono";
import { Store } from "@internal/core";
import type {
  VagaroAppointment,
  VagaroBusiness,
  VagaroCustomer,
  VagaroEmployee,
  VagaroLocation,
  VagaroPersonalTask,
  VagaroService,
} from "./entities.js";
import { getVagaroStore } from "./store.js";

type AccessTokenRecord = {
  business_id: string;
  region: string;
  expires_at: number;
};

export function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}`;
}

export function getAccessTokens(store: Store): Map<string, AccessTokenRecord> {
  let tokens = store.getData<Map<string, AccessTokenRecord>>("vagaro.accessTokens");
  if (!tokens) {
    tokens = new Map();
    store.setData("vagaro.accessTokens", tokens);
  }
  return tokens;
}

export function parseAccessToken(c: Context): string | null {
  const token = c.req.header("accessToken");
  return token?.trim() || null;
}

export function resolveBusiness(c: Context, store: Store, region?: string | null): VagaroBusiness | null {
  const vs = getVagaroStore(store);
  const accessToken = parseAccessToken(c);
  if (!accessToken) return null;
  const record = getAccessTokens(store).get(accessToken);
  if (!record) return null;
  if (region && record.region !== region) return null;
  return vs.businesses.findOneBy("business_id", record.business_id) ?? null;
}

export function requireBusiness(c: Context, store: Store, region?: string | null): VagaroBusiness | Response | null {
  const business = resolveBusiness(c, store, region);
  if (!business) {
    return c.json({
      status: 401,
      responseCode: 4001,
      message: "Invalid access token",
      data: null,
    }, 401);
  }
  return business;
}

export function envelope<T>(data: T) {
  return {
    status: 200,
    responseId: generateId("resp"),
    responseCode: 1000,
    message: "Success",
    data,
  };
}

export function formatService(service: VagaroService, employees: VagaroEmployee[]) {
  return {
    parentServiceId: service.parent_service_id,
    parentServiceTitle: service.parent_service_title,
    serviceId: service.service_id,
    serviceTitle: service.service_title,
    businessCost: service.business_cost,
    currency: service.currency,
    isLiveStreamService: false,
    isMobileService: false,
    cleanUpTimeMinutes: service.clean_up_time_minutes,
    showOnlineStatus: "Show",
    showPriceAsStartingPoint: false,
    type: "Service",
    addOnIds: [],
    servicePerformedBy: employees.map((employee) => ({
      serviceProviderId: employee.service_provider_id,
      price: service.business_cost,
      priceWithTax: Number((service.business_cost * 1.08).toFixed(2)),
      currency: service.currency,
      durationMinutes: service.duration_minutes,
      pointsGiven: 0,
      pointsRedeem: 0,
    })),
  };
}

export function formatAppointment(appointment: VagaroAppointment) {
  return {
    appointmentId: appointment.appointment_id,
    startTime: appointment.start_time,
    endTime: appointment.end_time,
    bookingStatus: appointment.booking_status,
    serviceTitle: appointment.service_title,
    serviceId: appointment.service_id,
    amount: appointment.amount,
    customerId: appointment.customer_id,
    serviceProviderId: appointment.service_provider_id,
    formResponseIds: [],
  };
}

export function formatEmployee(employee: VagaroEmployee) {
  return {
    serviceProviderId: employee.service_provider_id,
    firstName: employee.first_name,
    lastName: employee.last_name,
    email: employee.email,
    phone: employee.phone,
    title: employee.title,
  };
}

export function formatLocation(location: VagaroLocation) {
  return {
    locationId: location.location_id,
    locationName: location.location_name,
    address: location.address,
    city: location.city,
    state: location.state,
    zip: location.zip,
    phone: location.phone,
  };
}

export function formatCustomer(customer: VagaroCustomer) {
  return {
    customerId: customer.customer_id,
    firstName: customer.first_name,
    lastName: customer.last_name,
    email: customer.email,
    phone: customer.phone,
  };
}

export function availabilityForDate(date: string) {
  return {
    date,
    slots: [
      { time: "09:00 AM", available: true },
      { time: "09:30 AM", available: true },
      { time: "10:00 AM", available: false },
      { time: "10:30 AM", available: true },
      { time: "11:00 AM", available: true },
      { time: "01:00 PM", available: true },
      { time: "01:30 PM", available: true },
      { time: "02:00 PM", available: true },
    ],
  };
}

export function formatPersonalTask(task: VagaroPersonalTask) {
  return {
    personalTimeOffId: task.personal_time_off_id,
    status: "success",
    message: "Personal task operation completed",
  };
}
