import { bodyStr, parseJsonBody, requireAuth, type RouteContext } from "@internal/core";
import { formatAppointment, formatPayments, parseCreateBody, requireOwner } from "../helpers.js";
import { getAcuityStore } from "../store.js";

export function appointmentsRoutes({ app, store }: RouteContext): void {
  const as = getAcuityStore(store);

  app.post("/api/v1/appointments", requireAuth(), async (c) => {
    const owner = requireOwner(c, store);
    if (owner instanceof Response) return owner;
    const body = await parseJsonBody(c);
    const payload = parseCreateBody(body);

    const calendar = as.calendars.all().find((item) => item.owner_id === owner.id && item.external_id === payload.calendarID);
    const appointmentType = as.appointmentTypes.all().find((item) => item.owner_id === owner.id && item.external_id === payload.appointmentTypeID);

    if (!calendar || !appointmentType) {
      return c.json({ message: "Invalid appointment type or calendar" }, 400);
    }

    const appointment = as.appointments.insert({
      owner_id: owner.id,
      external_id: as.appointments.count() + 1000,
      appointment_type_id: payload.appointmentTypeID,
      calendar_id: payload.calendarID,
      datetime: payload.datetime,
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      amount_paid: appointmentType.price,
      scheduled_by: "emulate",
      location: calendar.location,
      canceled: false,
    });

    as.payments.insert({
      appointment_id: appointment.external_id,
      status: "paid",
      amount: appointmentType.price,
      currency: owner.currency,
      transaction_id: `pay_${appointment.external_id}`,
    });

    return c.json(formatAppointment(appointment), 201);
  });

  app.get("/api/v1/appointments", requireAuth(), (c) => {
    const owner = requireOwner(c, store);
    if (owner instanceof Response) return owner;

    const appointmentTypeId = Number(c.req.query("appointmentTypeID") ?? "0");
    const calendarId = Number(c.req.query("calendarID") ?? "0");
    const minDate = c.req.query("minDate");

    const appointments = as.appointments
      .all()
      .filter((appointment) => appointment.owner_id === owner.id)
      .filter((appointment) => !appointmentTypeId || appointment.appointment_type_id === appointmentTypeId)
      .filter((appointment) => !calendarId || appointment.calendar_id === calendarId)
      .filter((appointment) => !minDate || appointment.datetime.slice(0, 10) >= minDate)
      .sort((a, b) => a.datetime.localeCompare(b.datetime))
      .map(formatAppointment);

    return c.json(appointments);
  });

  app.get("/api/v1/appointments/:id", requireAuth(), (c) => {
    const owner = requireOwner(c, store);
    if (owner instanceof Response) return owner;

    const id = Number(c.req.param("id"));
    const appointment = as.appointments
      .all()
      .find((item) => item.owner_id === owner.id && item.external_id === id);

    if (!appointment) {
      return c.json({ message: "Appointment not found" }, 404);
    }
    return c.json(formatAppointment(appointment));
  });

  app.put("/api/v1/appointments/:id/cancel", requireAuth(), (c) => {
    const owner = requireOwner(c, store);
    if (owner instanceof Response) return owner;

    const id = Number(c.req.param("id"));
    const appointment = as.appointments
      .all()
      .find((item) => item.owner_id === owner.id && item.external_id === id);
    if (!appointment) {
      return c.json({ message: "Appointment not found" }, 404);
    }

    const updated = as.appointments.update(appointment.id, { canceled: true });
    return c.json(formatAppointment(updated!));
  });

  app.get("/api/v1/appointments/:id/payments", requireAuth(), (c) => {
    const owner = requireOwner(c, store);
    if (owner instanceof Response) return owner;

    const appointmentId = Number(c.req.param("id"));
    const appointment = as.appointments
      .all()
      .find((item) => item.owner_id === owner.id && item.external_id === appointmentId);
    if (!appointment) {
      return c.json([], 404);
    }

    const payments = as.payments
      .all()
      .filter((payment) => payment.appointment_id === appointmentId);

    return c.json(formatPayments(payments));
  });
}
