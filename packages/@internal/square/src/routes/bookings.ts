import type { Context } from "hono";
import { bodyStr, parseJsonBody, type RouteContext } from "@internal/core";
import { buildAvailability, formatBooking, requireMerchant } from "../helpers.js";
import { getSquareStore } from "../store.js";

function readBodyField(body: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in body) return body[key];
  }
  return undefined;
}

export function bookingsRoutes({ app, store }: RouteContext): void {
  const ss = getSquareStore(store);

  const availabilityHandler = async (c: Context) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const body = await parseJsonBody(c);
    const query = (body.query ?? {}) as Record<string, unknown>;
    const filter = (query.filter ?? {}) as Record<string, unknown>;
    const startAtRange = (filter.start_at_range ?? filter.startAtRange ?? {}) as Record<string, unknown>;
    const locationId = bodyStr(filter.location_id ?? filter.locationId) || ss.locations.all().find((location) => location.merchant_id === merchant.merchant_id)?.location_id || "";
    const segmentFilters = (filter.segment_filters ?? filter.segmentFilters ?? []) as Array<Record<string, unknown>>;

    const segments = segmentFilters.map((segment) => ({
      service_variation_id: bodyStr(segment.service_variation_id ?? segment.serviceVariationId),
      service_variation_version: Number(segment.service_variation_version ?? segment.serviceVariationVersion ?? 1),
      team_member_id:
        bodyStr(
          segment.team_member_id ??
            segment.teamMemberId ??
            ((segment.team_member_id_filter ?? segment.teamMemberIdFilter ?? {}) as Record<string, unknown>).any?.[0]
        ) || ss.teamMembers.all().find((member) => member.merchant_id === merchant.merchant_id)?.team_member_id || "",
      duration_minutes:
        ss.serviceVariations
          .all()
          .find((variation) => variation.variation_id === bodyStr(segment.service_variation_id ?? segment.serviceVariationId))
          ?.duration ?? 30,
    }));

    const startAt = bodyStr(startAtRange.start_at ?? startAtRange.startAt) || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return c.json({
      availabilities: buildAvailability(locationId, segments, startAt),
    });
  };

  app.post("/v2/bookings/search/availability", availabilityHandler);
  app.post("/v2/bookings/availability/search", availabilityHandler);

  app.post("/v2/bookings", async (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;

    const body = await parseJsonBody(c);
    const bookingPayload = (body.booking ?? {}) as Record<string, unknown>;
    const segmentsRaw = (bookingPayload.appointment_segments ?? bookingPayload.appointmentSegments ?? []) as Array<Record<string, unknown>>;

    const booking = ss.bookings.insert({
      booking_id: `BKG_${Math.random().toString(36).slice(2, 14)}`,
      merchant_id: merchant.merchant_id,
      location_id:
        bodyStr(bookingPayload.location_id ?? bookingPayload.locationId) ||
        ss.locations.all().find((location) => location.merchant_id === merchant.merchant_id)?.location_id ||
        "",
      customer_id: bodyStr(bookingPayload.customer_id ?? bookingPayload.customerId),
      start_at: bodyStr(bookingPayload.start_at ?? bookingPayload.startAt) || new Date().toISOString(),
      status: "ACCEPTED",
      version: 1,
      customer_note: bodyStr(bookingPayload.customer_note ?? bookingPayload.customerNote) || null,
      seller_note: bodyStr(bookingPayload.seller_note ?? bookingPayload.sellerNote) || null,
      appointment_segments: segmentsRaw.map((segment) => ({
        service_variation_id: bodyStr(segment.service_variation_id ?? segment.serviceVariationId),
        service_variation_version: Number(segment.service_variation_version ?? segment.serviceVariationVersion ?? 1),
        team_member_id: bodyStr(segment.team_member_id ?? segment.teamMemberId),
        duration_minutes:
          Number(segment.duration_minutes ?? segment.durationMinutes) ||
          ss.serviceVariations
            .all()
            .find((variation) => variation.variation_id === bodyStr(segment.service_variation_id ?? segment.serviceVariationId))
            ?.duration ||
          30,
      })),
    });

    return c.json({ booking: formatBooking(booking) });
  });

  app.get("/v2/bookings/:id", (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const booking = ss.bookings
      .all()
      .find((item) => item.merchant_id === merchant.merchant_id && item.booking_id === c.req.param("id"));
    if (!booking) {
      return c.json({ errors: [{ code: "NOT_FOUND", detail: "Booking not found" }] }, 404);
    }
    return c.json({ booking: formatBooking(booking) });
  });

  app.get("/v2/bookings", (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const customerId = c.req.query("customer_id") ?? c.req.query("customerId");
    const locationId = c.req.query("location_id") ?? c.req.query("locationId");

    const bookings = ss.bookings
      .all()
      .filter((booking) => booking.merchant_id === merchant.merchant_id)
      .filter((booking) => !customerId || booking.customer_id === customerId)
      .filter((booking) => !locationId || booking.location_id === locationId)
      .map(formatBooking);

    return c.json({ bookings });
  });

  app.post("/v2/bookings/:id/cancel", async (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const booking = ss.bookings
      .all()
      .find((item) => item.merchant_id === merchant.merchant_id && item.booking_id === c.req.param("id"));
    if (!booking) {
      return c.json({ errors: [{ code: "NOT_FOUND", detail: "Booking not found" }] }, 404);
    }
    const updated = ss.bookings.update(booking.id, {
      status: "CANCELLED_BY_SELLER",
      version: booking.version + 1,
    })!;
    return c.json({ booking: formatBooking(updated) });
  });
}
