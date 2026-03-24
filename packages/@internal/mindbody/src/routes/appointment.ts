import { parseJsonBody, type RouteContext } from "@internal/core";
import {
  addMinutes,
  formatAppointment,
  formatBookableItem,
  pagination,
  requireSite,
} from "../helpers.js";
import { getMindbodyStore } from "../store.js";

export function appointmentRoutes({ app, store }: RouteContext): void {
  const ms = getMindbodyStore(store);

  app.get("/public/v6/appointment/bookableitems", (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const locationIds = (c.req.query("locationIds") ?? "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    const sessionTypeIds = (c.req.query("sessionTypeIds") ?? "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    const items = ms.appointments
      .all()
      .filter((appointment) => appointment.site_id === auth.site.site_id)
      .filter((appointment) => locationIds.length === 0 || locationIds.includes(appointment.location_id))
      .filter((appointment) => sessionTypeIds.length === 0 || sessionTypeIds.includes(appointment.session_type_id))
      .map((appointment) =>
        formatBookableItem(
          appointment,
          ms.sessionTypes.all().find((sessionType) => sessionType.session_type_id === appointment.session_type_id),
          ms.locations.all().find((location) => location.location_id === appointment.location_id)
        )
      );

    return c.json({
      PaginationResponse: pagination(items.length),
      Availabilities: items,
    });
  });

  app.post("/public/v6/appointment/addappointment", async (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const body = await parseJsonBody(c);
    const sessionTypeId = Number(body.SessionTypeId);
    const locationId = Number(body.LocationId);
    const startDateTime = typeof body.StartDateTime === "string" ? body.StartDateTime : new Date().toISOString();
    const sessionType = ms.sessionTypes
      .all()
      .find((item) => item.site_id === auth.site.site_id && item.session_type_id === sessionTypeId);
    if (!sessionType) {
      return c.json({
        Error: {
          Message: "Invalid SessionTypeId. A valid session type is required to create an appointment.",
          Code: "400",
        },
      }, 400);
    }

    const appointment = ms.appointments.insert({
      site_id: auth.site.site_id,
      appointment_id: ms.appointments.count() + 90000,
      client_id: typeof body.ClientId === "string" ? body.ClientId : "100000",
      location_id: locationId,
      session_type_id: sessionTypeId,
      staff_id: Number(body.StaffId) || 100000001,
      start_date_time: startDateTime,
      end_date_time: addMinutes(startDateTime, sessionType.default_time_length),
      duration: sessionType.default_time_length,
      status: "Booked",
      notes: typeof body.Notes === "string" ? body.Notes : "Created via emulate",
      staff_first_name: "Alex",
      staff_last_name: "Stylist",
    });

    return c.json({
      Appointment: formatAppointment(
        appointment,
        ms.clients.all().find((client) => client.client_id === appointment.client_id)
      ),
    });
  });

  app.post("/public/v6/appointment/updateappointment", async (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const body = await parseJsonBody(c);
    const appointmentId = Number(body.AppointmentId);
    const appointment = ms.appointments
      .all()
      .find((item) => item.site_id === auth.site.site_id && item.appointment_id === appointmentId);

    if (!appointment) {
      return c.json({
        Error: {
          Message: "Appointment not found.",
          Code: "404",
        },
      }, 404);
    }

    const execute = typeof body.Execute === "string" ? body.Execute.toLowerCase() : "";
    const startDateTime = typeof body.StartDateTime === "string" ? body.StartDateTime : appointment.start_date_time;
    const status = execute === "cancel" ? "Cancelled" : appointment.status;
    const updated = ms.appointments.update(appointment.id, {
      start_date_time: startDateTime,
      end_date_time: startDateTime !== appointment.start_date_time ? addMinutes(startDateTime, appointment.duration) : appointment.end_date_time,
      status,
      notes: execute === "cancel" ? "Cancelled via emulate" : "Rescheduled via emulate",
    })!;

    return c.json({
      Appointment: formatAppointment(
        updated,
        ms.clients.all().find((client) => client.client_id === updated.client_id)
      ),
    });
  });

  app.get("/public/v6/appointment/staffappointments", (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const locationId = Number(c.req.query("locationId") ?? "0");
    const clientId = c.req.query("clientId");
    const startDate = c.req.query("startDate");

    const appointments = ms.appointments
      .all()
      .filter((appointment) => appointment.site_id === auth.site.site_id)
      .filter((appointment) => !locationId || appointment.location_id === locationId)
      .filter((appointment) => !clientId || appointment.client_id === clientId)
      .filter((appointment) => !startDate || appointment.start_date_time.slice(0, 10) >= startDate)
      .map((appointment) =>
        formatAppointment(
          appointment,
          ms.clients.all().find((client) => client.client_id === appointment.client_id)
        )
      );

    return c.json({
      PaginationResponse: pagination(appointments.length),
      Appointments: appointments,
    });
  });
}
