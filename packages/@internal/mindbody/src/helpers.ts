import type { Context } from "hono";
import { Store } from "@internal/core";
import type {
  MindbodyAppointment,
  MindbodyClient,
  MindbodyLocation,
  MindbodyProgram,
  MindbodySessionType,
  MindbodySite,
  MindbodyUserToken,
} from "./entities.js";
import { getMindbodyStore } from "./store.js";

export function generateToken(prefix = "mb"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 18)}`;
}

export function getApiKey(store: Store): string {
  return store.getData<string>("mindbody.api_key") ?? "test-api-key";
}

export function setApiKey(store: Store, apiKey: string): void {
  store.setData("mindbody.api_key", apiKey);
}

export function parseBearer(c: Context): string | null {
  const auth = c.req.header("Authorization");
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

function validateHeaders(c: Context, store: Store, requireBearer: boolean): { site: MindbodySite; token?: MindbodyUserToken } | Response {
  const ms = getMindbodyStore(store);
  const apiKey = c.req.header("Api-Key");
  const siteId = c.req.header("SiteId");

  if (!apiKey || apiKey !== getApiKey(store) || !siteId) {
    return c.json({ Error: { Message: "Invalid Api-Key or SiteId", Code: "401" } }, 401);
  }

  const site = ms.sites.findOneBy("site_id", siteId);
  if (!site) {
    return c.json({ Error: { Message: "Site not found", Code: "404" } }, 404);
  }

  if (!requireBearer) {
    return { site };
  }

  const tokenValue = parseBearer(c);
  if (!tokenValue) {
    return c.json({ Error: { Message: "Missing bearer token", Code: "401" } }, 401);
  }

  const token = ms.userTokens
    .all()
    .find((item) => item.site_id === siteId && item.access_token === tokenValue);
  if (!token) {
    return c.json({ Error: { Message: "Invalid bearer token", Code: "401" } }, 401);
  }
  return { site, token };
}

export function requireSite(c: Context, store: Store, requireBearer = true): { site: MindbodySite; token?: MindbodyUserToken } | Response {
  return validateHeaders(c, store, requireBearer);
}

export function guessCardType(cardNumber: string): string {
  if (cardNumber.startsWith("4")) return "Visa";
  if (cardNumber.startsWith("5")) return "MasterCard";
  if (cardNumber.startsWith("3")) return "Amex";
  return "Card";
}

export function addMinutes(startIso: string, minutes: number): string {
  return new Date(new Date(startIso).getTime() + minutes * 60_000).toISOString();
}

export function pagination(total: number) {
  return {
    RequestedLimit: 100,
    RequestedOffset: 0,
    PageSize: total,
    TotalResults: total,
  };
}

export function formatSite(site: MindbodySite) {
  return {
    Id: site.site_id,
    Name: site.name,
    ContactEmail: site.email,
    CurrencyIsoCode: site.currency,
  };
}

export function formatLocation(location: MindbodyLocation) {
  return {
    Id: location.location_id,
    SiteID: location.site_id,
    Name: location.name,
    Address: location.address,
    Address2: location.address2,
    City: location.city,
    PostalCode: location.postal_code,
    Phone: location.phone,
    Latitude: location.latitude,
    Longitude: location.longitude,
  };
}

export function formatSessionType(sessionType: MindbodySessionType) {
  return {
    Id: sessionType.session_type_id,
    Type: sessionType.type,
    Name: sessionType.name,
    NumDeducted: sessionType.num_deducted,
    ProgramId: sessionType.program_id,
    Description: sessionType.description,
    DefaultTimeLength: sessionType.default_time_length,
    Category: sessionType.category,
  };
}

export function formatProgram(program: MindbodyProgram) {
  return {
    Id: program.program_id,
    Name: program.name,
    ScheduleType: program.schedule_type,
    CancelOffset: program.cancel_offset,
  };
}

export function formatClient(client: MindbodyClient) {
  return {
    Id: client.client_id,
    UniqueId: client.unique_id,
    FirstName: client.first_name,
    LastName: client.last_name,
    Email: client.email ?? "",
    MobilePhone: client.mobile_phone ?? "",
    HomePhone: client.home_phone ?? "",
    WorkPhone: client.work_phone ?? "",
    AddressLine1: client.address_line_1 ?? "",
    AddressLine2: client.address_line_2 ?? "",
    City: client.city ?? "",
    State: client.state ?? "",
    PostalCode: client.postal_code ?? "",
    Country: client.country ?? "",
    BirthDate: client.birth_date ?? "",
    Gender: client.gender ?? "",
    IsProspect: client.is_prospect,
    Status: client.status,
    CreationDate: client.creation_date,
    ...(client.card_last_four
      ? {
          ClientCreditCard: {
            CardType: client.card_type,
            LastFour: client.card_last_four,
          },
        }
      : {}),
  };
}

export function formatAppointment(appointment: MindbodyAppointment, client?: MindbodyClient) {
  return {
    Id: appointment.appointment_id,
    ClientId: appointment.client_id,
    LocationId: appointment.location_id,
    StaffId: appointment.staff_id,
    StartDateTime: appointment.start_date_time,
    EndDateTime: appointment.end_date_time,
    Duration: appointment.duration,
    Status: appointment.status,
    Notes: appointment.notes,
    SessionTypeId: appointment.session_type_id,
    StaffFirstName: appointment.staff_first_name,
    StaffLastName: appointment.staff_last_name,
    ...(client
      ? {
          ClientFirstName: client.first_name,
          ClientLastName: client.last_name,
        }
      : {}),
  };
}

export function formatBookableItem(
  appointment: MindbodyAppointment,
  sessionType: MindbodySessionType | undefined,
  location: MindbodyLocation | undefined,
) {
  return {
    StartDateTime: appointment.start_date_time,
    EndDateTime: appointment.end_date_time,
    Staff: {
      Id: appointment.staff_id,
      FirstName: appointment.staff_first_name,
      LastName: appointment.staff_last_name,
      Name: `${appointment.staff_first_name} ${appointment.staff_last_name}`.trim(),
    },
    Location: location
      ? {
          Id: location.location_id,
          Name: location.name,
        }
      : null,
    SessionType: sessionType
      ? {
          Id: sessionType.session_type_id,
          Name: sessionType.name,
        }
      : null,
  };
}
