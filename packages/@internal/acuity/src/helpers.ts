import type { Context } from "hono";
import { Store, bodyStr, constantTimeSecretEqual } from "@internal/core";
import type {
  AcuityAppointment,
  AcuityAppointmentType,
  AcuityCalendar,
  AcuityOAuthClient,
  AcuityOwner,
  AcuityPayment,
} from "./entities.js";
import { getAcuityStore } from "./store.js";

type PendingCode = {
  owner_id: number;
  client_id: string;
  redirect_uri: string;
  scope: string;
  created_at: number;
};

type AccessTokenRecord = {
  owner_id: number;
  client_id: string;
  created_at: number;
};

const CODE_TTL_MS = 10 * 60 * 1000;

export function generateToken(prefix = "acuity"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 20)}`;
}

export function generateOwnerKey(): string {
  return generateToken("owner");
}

export function getPendingCodes(store: Store): Map<string, PendingCode> {
  let codes = store.getData<Map<string, PendingCode>>("acuity.oauth.pendingCodes");
  if (!codes) {
    codes = new Map();
    store.setData("acuity.oauth.pendingCodes", codes);
  }
  return codes;
}

export function getAccessTokens(store: Store): Map<string, AccessTokenRecord> {
  let tokens = store.getData<Map<string, AccessTokenRecord>>("acuity.oauth.accessTokens");
  if (!tokens) {
    tokens = new Map();
    store.setData("acuity.oauth.accessTokens", tokens);
  }
  return tokens;
}

export function parseBearerToken(c: Context): string | null {
  const auth = c.req.header("Authorization");
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

export function resolveOwnerFromAuth(c: Context, store: Store): AcuityOwner | null {
  const as = getAcuityStore(store);
  const token = parseBearerToken(c);
  if (token) {
    const tokenRecord = getAccessTokens(store).get(token);
    if (tokenRecord) {
      return as.owners.get(tokenRecord.owner_id) ?? null;
    }
  }
  if (c.get("authUser")) {
    return as.owners.all()[0] ?? null;
  }
  return null;
}

export function requireOwner(c: Context, store: Store): AcuityOwner | Response | null {
  const owner = resolveOwnerFromAuth(c, store);
  if (!owner) {
    return c.json({ error: "unauthorized", message: "Requires authentication" }, 401);
  }
  return owner;
}

export function formatOwner(owner: AcuityOwner) {
  return {
    id: owner.id,
    ownerKey: owner.owner_key,
    displayName: owner.name,
    email: owner.email,
    created: owner.created,
    currency: owner.currency,
  };
}

export function formatCalendar(calendar: AcuityCalendar) {
  return {
    id: calendar.external_id,
    name: calendar.name,
    email: calendar.email,
    replyTo: calendar.reply_to,
    description: calendar.description,
    location: calendar.location,
    timezone: calendar.timezone,
    thumbnail: calendar.thumbnail ?? "",
    image: calendar.image ?? "",
    isValid: calendar.is_valid,
  };
}

export function formatAppointmentType(type: AcuityAppointmentType) {
  return {
    id: type.external_id,
    active: type.active,
    name: type.name,
    description: type.description,
    duration: type.duration,
    price: type.price,
    image: type.image ?? "",
    category: type.category,
    color: type.color,
    private: type.private,
    type: type.type,
    classSize: type.class_size,
    paddingAfter: type.padding_after,
    paddingBefore: type.padding_before,
    calendarIDs: type.calendar_ids,
    addonIDs: type.addon_ids,
    formIDs: type.form_ids,
    schedulingUrl: type.scheduling_url,
  };
}

export function formatAppointment(appointment: AcuityAppointment) {
  return {
    id: appointment.external_id,
    appointmentTypeID: appointment.appointment_type_id,
    calendarID: appointment.calendar_id,
    datetime: appointment.datetime,
    firstName: appointment.first_name,
    lastName: appointment.last_name,
    email: appointment.email,
    phone: appointment.phone,
    amountPaid: appointment.amount_paid,
    scheduled_by: appointment.scheduled_by,
    location: appointment.location,
    canceled: appointment.canceled,
  };
}

export function formatPayments(payments: AcuityPayment[]) {
  return payments.map((payment) => ({
    id: payment.transaction_id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
  }));
}

export function availabilityDates(month: string): Array<{ date: string }> {
  const [yearPart, monthPart] = month.split("-").map((value) => Number(value));
  const year = Number.isFinite(yearPart) ? yearPart : new Date().getUTCFullYear();
  const monthNumber = Number.isFinite(monthPart) ? monthPart : new Date().getUTCMonth() + 1;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dates: Array<{ date: string }> = [];
  for (let day = 1; day <= daysInMonth && dates.length < 10; day++) {
    const date = new Date(Date.UTC(year, monthNumber - 1, day));
    const weekday = date.getUTCDay();
    if (weekday === 0) continue;
    dates.push({ date: date.toISOString().slice(0, 10) });
  }
  return dates;
}

export function availabilityTimes(date: string, maxDays: number): Record<string, Array<{ time: string; slotsAvailable: number }>> {
  const result: Record<string, Array<{ time: string; slotsAvailable: number }>> = {};
  for (let offset = 0; offset < Math.max(1, maxDays); offset++) {
    const baseDate = new Date(`${date}T00:00:00.000Z`);
    baseDate.setUTCDate(baseDate.getUTCDate() + offset);
    const key = baseDate.toISOString().slice(0, 10);
    result[key] = [9, 11, 14].map((hour) => ({
      time: new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), hour, 0, 0)).toISOString(),
      slotsAvailable: hour === 11 ? 1 : 2,
    }));
  }
  return result;
}

export async function parseTokenBody(c: Context): Promise<Record<string, unknown>> {
  const contentType = c.req.header("Content-Type") ?? "";
  const raw = await c.req.text();
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

export function validateOAuthClient(client: AcuityOAuthClient | undefined, clientSecret: string): client is AcuityOAuthClient {
  if (!client) return false;
  return constantTimeSecretEqual(clientSecret, client.client_secret);
}

export function bodyStringField(value: unknown): string {
  return bodyStr(value);
}

export function parseCreateBody(body: Record<string, unknown>) {
  return {
    appointmentTypeID: Number(body.appointmentTypeID),
    datetime: bodyStringField(body.datetime),
    firstName: bodyStringField(body.firstName),
    lastName: bodyStringField(body.lastName),
    email: bodyStringField(body.email),
    calendarID: Number(body.calendarID),
    phone: bodyStringField(body.phone) || null,
  };
}
