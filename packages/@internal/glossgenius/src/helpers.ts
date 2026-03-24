import type { Context } from "hono";
import type {
  GlossgeniusAppointment,
  GlossgeniusBusiness,
  GlossgeniusPortfolioImage,
  GlossgeniusProvider,
  GlossgeniusReview,
  GlossgeniusService,
} from "./entities.js";
import type { GlossgeniusStore } from "./store.js";

export function generateGuid(prefix = "gg"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

export function generateAccessToken(slug: string): string {
  return `gg_${slug.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_token`;
}

export function addMinutes(startIso: string, minutes: number): string {
  return new Date(new Date(startIso).getTime() + minutes * 60_000).toISOString();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function parseBearerToken(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

export function resolveBusinessForAuth(c: Context, gs: GlossgeniusStore): GlossgeniusBusiness | null {
  const token = parseBearerToken(c);
  if (token) {
    const business = gs.businesses.findOneBy("access_token", token);
    if (business) return business;
  }
  if (c.get("authUser")) {
    return gs.businesses.all()[0] ?? null;
  }
  return null;
}

export function resolveBusinessBySlug(gs: GlossgeniusStore, slug?: string | null): GlossgeniusBusiness | null {
  if (slug) {
    return gs.businesses.findOneBy("slug", slug) ?? null;
  }
  return gs.businesses.all()[0] ?? null;
}

export function formatReview(review: GlossgeniusReview) {
  return {
    rating: review.rating,
    message: review.message,
    reviewer_name: review.reviewer_name,
    created_at: review.published_at,
  };
}

export function formatPortfolioImage(image: GlossgeniusPortfolioImage) {
  return {
    guid: image.guid,
    image: {
      original: image.url,
    },
    caption: image.caption,
  };
}

function formatAppointmentService(
  service: GlossgeniusService,
  provider: GlossgeniusProvider | undefined,
  appointment: GlossgeniusAppointment,
  order: number,
) {
  return {
    id: service.id,
    createdAt: appointment.created_at,
    updatedAt: appointment.updated_at,
    startTime: appointment.start_time,
    endTime: appointment.end_time,
    startDuration: service.duration,
    processingDuration: 0,
    endDuration: 0,
    totalDuration: service.duration,
    trailingBufferDuration: 0,
    orderWithinAppointment: order,
    deletedAt: null,
    appointmentToken: appointment.appointment_token,
    token: service.token,
    name: service.name,
    price: service.price,
    image: service.image ?? "",
    description: service.description,
    hasProcessingTime: false,
    priceVaries: false,
    priceHidden: false,
    categoryName: service.category_name,
    onlineBookable: service.online_bookable,
    demo: false,
    ordering: order,
    color: provider?.color ?? "#111111",
    assignedUsers: provider ? [provider.guid] : [],
    assignedUserBusinessMemberTokens: provider ? [provider.token] : [],
    buffer: { trailingDuration: 0 },
    depositRequired: false,
    depositAmount: null,
    depositForNewClientsOnly: false,
    bookingOrder: null,
    businessToken: appointment.business_slug,
    salonSlug: appointment.business_slug,
    parentToken: null,
    parentName: null,
    parentPrice: null,
    resources: [],
    guid: service.guid,
    serviceGuid: service.guid,
    serviceOptionGuid: null,
    categoryId: null,
    depositProcessingFee: "0.00",
  };
}

export function formatAppointment(
  appointment: GlossgeniusAppointment,
  business: GlossgeniusBusiness,
  provider: GlossgeniusProvider | undefined,
  services: GlossgeniusService[],
) {
  const appointmentServices = services.map((service, index) =>
    formatAppointmentService(service, provider, appointment, index)
  );

  return {
    guid: appointment.guid,
    createdAt: appointment.created_at,
    updatedAt: appointment.updated_at,
    startTime: appointment.start_time,
    endTime: appointment.end_time,
    startDuration: services[0]?.duration ?? 0,
    processingDuration: 0,
    endDuration: 0,
    totalDuration: services.reduce((sum, service) => sum + service.duration, 0),
    totalPrice: appointment.total_price,
    status: appointment.status,
    cancellationFee: "0.00",
    cancelledByClient: null,
    hasProcessingTime: false,
    editable: appointment.status !== "cancelled",
    cardPayment: false,
    serviceImage: services[0]?.image ?? "",
    checkedOut: false,
    selfScheduled: true,
    confirmed: appointment.status === "confirmed" || appointment.status === "booked",
    confirmable: appointment.status !== "cancelled",
    refundable: appointment.status !== "cancelled",
    cancellable: appointment.status !== "cancelled",
    noShow: null,
    recurrenceId: null,
    addressInformation: business.name,
    decoratedStatus: appointment.status,
    providerGuid: provider?.guid ?? "",
    providerFullName: provider?.name ?? "Any Provider",
    demo: false,
    clientId: appointment.client_id,
    clientToken: `client_${appointment.client_id}`,
    clientName: appointment.client_name,
    clientEmail: appointment.client_email,
    clientPhone: appointment.client_phone,
    hasNotes: false,
    clientInitials: initials(appointment.client_name),
    clientPronouns: null,
    clientProfileImage: null,
    chargeGuid: null,
    buffer: { trailingDuration: 0 },
    bundleToken: null,
    appointmentToken: appointment.appointment_token,
    providerBusinessMemberToken: provider?.token ?? "",
    depositAmount: null,
    depositAmountRemaining: "0.00",
    depositCollected: false,
    bookedFromAutomatedWaitlistOutreach: false,
    appointmentAddress: {
      address1: null,
      address2: null,
      city: null,
      state: null,
      postalCode: null,
    },
    services: appointmentServices,
  };
}

export function buildAvailableTimes(
  business: GlossgeniusBusiness,
  services: GlossgeniusService[],
  providers: GlossgeniusProvider[],
  month: number,
  year: number,
) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalDuration = Math.max(services.reduce((sum, service) => sum + service.duration, 0), 30);
  const providerGuids = providers.map((provider) => provider.guid);

  const data: Array<{ date: string; times: Array<{ time: string; start: string; end: string; providerGuids: string[] }> }> = [];

  for (let day = 1; day <= Math.min(daysInMonth, 10); day++) {
    const start = new Date(Date.UTC(year, month - 1, day, 14, 0, 0));
    const weekday = start.getUTCDay();
    if (weekday === 0) continue;

    const slots = [0, 120].map((offset) => {
      const slotStart = new Date(start.getTime() + offset * 60_000);
      const slotEnd = new Date(slotStart.getTime() + totalDuration * 60_000);
      return {
        time: slotStart.toISOString(),
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        providerGuids,
      };
    });

    data.push({
      date: new Date(Date.UTC(year, month - 1, day)).toISOString(),
      times: slots,
    });
  }

  return {
    business,
    data,
  };
}
