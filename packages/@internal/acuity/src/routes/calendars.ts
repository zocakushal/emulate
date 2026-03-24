import { requireAuth, type RouteContext } from "@internal/core";
import { formatAppointmentType, formatCalendar, formatOwner, requireOwner } from "../helpers.js";
import { getAcuityStore } from "../store.js";

export function calendarsRoutes({ app, store }: RouteContext): void {
  const as = getAcuityStore(store);

  app.get("/api/v1/me", requireAuth(), (c) => {
    const owner = requireOwner(c, store);
    if (owner instanceof Response) return owner;
    return c.json(formatOwner(owner));
  });

  app.get("/api/v1/appointment-types", requireAuth(), (c) => {
    const owner = requireOwner(c, store);
    if (owner instanceof Response) return owner;
    const types = as.appointmentTypes
      .all()
      .filter((type) => type.owner_id === owner.id)
      .map(formatAppointmentType);
    return c.json(types);
  });

  app.get("/api/v1/calendars", requireAuth(), (c) => {
    const owner = requireOwner(c, store);
    if (owner instanceof Response) return owner;
    const calendars = as.calendars
      .all()
      .filter((calendar) => calendar.owner_id === owner.id)
      .map(formatCalendar);
    return c.json(calendars);
  });
}
