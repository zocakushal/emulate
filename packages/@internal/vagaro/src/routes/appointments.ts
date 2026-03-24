import { parseJsonBody, type RouteContext } from "@internal/core";
import { availabilityForDate, envelope, formatAppointment, requireBusiness } from "../helpers.js";
import { getVagaroStore } from "../store.js";

export function appointmentsRoutes({ app, store }: RouteContext): void {
  const vs = getVagaroStore(store);

  app.post("/:region/api/v2/appointments", async (c) => {
    const region = c.req.param("region");
    const business = requireBusiness(c, store, region);
    if (business instanceof Response) return business;

    const body = await parseJsonBody(c);
    const customerId = typeof body.customerId === "string" ? body.customerId : undefined;
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId : undefined;

    const appointments = vs.appointments
      .all()
      .filter((appointment) => appointment.business_id === business.business_id)
      .filter((appointment) => !customerId || appointment.customer_id === customerId)
      .filter((appointment) => !appointmentId || appointment.appointment_id === appointmentId)
      .map(formatAppointment);

    return c.json(envelope(appointments));
  });

  app.post("/:region/api/v2/appointments/availability", async (c) => {
    const region = c.req.param("region");
    const business = requireBusiness(c, store, region);
    if (business instanceof Response) return business;

    const body = await parseJsonBody(c);
    const appointmentDate =
      typeof body.appointmentDate === "string"
        ? body.appointmentDate
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return c.json(envelope([availabilityForDate(appointmentDate)]));
  });
}
