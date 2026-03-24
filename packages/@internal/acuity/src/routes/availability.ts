import { requireAuth, type RouteContext } from "@internal/core";
import { availabilityDates, availabilityTimes, requireOwner } from "../helpers.js";

export function availabilityRoutes({ app, store }: RouteContext): void {
  app.get("/api/v1/availability/dates", requireAuth(), (c) => {
    const owner = requireOwner(c, store);
    if (owner instanceof Response) return owner;
    const month = c.req.query("month") ?? new Date().toISOString().slice(0, 7);
    return c.json(availabilityDates(month));
  });

  app.get("/api/v1/availability/times", requireAuth(), (c) => {
    const owner = requireOwner(c, store);
    if (owner instanceof Response) return owner;
    const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);
    const maxDays = Number(c.req.query("maxDays") ?? "2");
    return c.json(availabilityTimes(date, maxDays));
  });
}
