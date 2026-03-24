import { requireAuth, type RouteContext } from "@internal/core";
import { formatAppointment, resolveBusinessForAuth } from "../helpers.js";
import { getGlossgeniusStore } from "../store.js";

export function appointmentsRoutes({ app, store }: RouteContext): void {
  const gs = getGlossgeniusStore(store);

  app.get("/v3/appointments", requireAuth(), (c) => {
    const business = resolveBusinessForAuth(c, gs);
    if (!business) {
      return c.json({ message: "Requires authentication" }, 401);
    }

    const from = c.req.query("from");
    const to = c.req.query("to");

    const appointments = gs.appointments
      .all()
      .filter((appointment) => appointment.business_slug === business.slug)
      .filter((appointment) => {
        if (from && appointment.start_time < from) return false;
        if (to && appointment.start_time > to) return false;
        return true;
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((appointment) => {
        const provider = gs.providers.findOneBy("guid", appointment.provider_guid);
        const services = appointment.service_guids
          .map((guid) => gs.services.findOneBy("guid", guid))
          .filter((service): service is NonNullable<typeof service> => Boolean(service));
        return formatAppointment(appointment, business, provider, services);
      });

    return c.json({
      data: appointments,
      meta: {
        total: appointments.length,
        from: from ?? null,
        to: to ?? null,
      },
    });
  });
}
