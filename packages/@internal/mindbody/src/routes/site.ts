import type { RouteContext } from "@internal/core";
import {
  formatLocation,
  formatProgram,
  formatSessionType,
  formatSite,
  pagination,
  requireSite,
} from "../helpers.js";
import { getMindbodyStore } from "../store.js";

export function siteRoutes({ app, store }: RouteContext): void {
  const ms = getMindbodyStore(store);

  app.get("/public/v6/site/sites", (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const requestedSiteIds = (c.req.query("siteIds") ?? auth.site.site_id)
      .split(",")
      .map((value) => value.trim());
    const sites = ms.sites
      .all()
      .filter((site) => requestedSiteIds.includes(site.site_id))
      .map(formatSite);

    return c.json({
      PaginationResponse: pagination(sites.length),
      Sites: sites,
    });
  });

  app.get("/public/v6/site/sessiontypes", (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const programIds = (c.req.query("ProgramIds") ?? "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    const sessionTypes = ms.sessionTypes
      .all()
      .filter((item) => item.site_id === auth.site.site_id)
      .filter((item) => programIds.length === 0 || programIds.includes(item.program_id))
      .map(formatSessionType);

    return c.json({
      PaginationResponse: pagination(sessionTypes.length),
      SessionTypes: sessionTypes,
    });
  });

  app.get("/public/v6/site/programs", (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const scheduleType = c.req.query("ScheduleType");
    const programs = ms.programs
      .all()
      .filter((item) => item.site_id === auth.site.site_id)
      .filter((item) => !scheduleType || item.schedule_type === scheduleType)
      .map(formatProgram);

    return c.json({
      PaginationResponse: pagination(programs.length),
      Programs: programs,
    });
  });

  app.get("/public/v6/site/locations", (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const locations = ms.locations
      .all()
      .filter((item) => item.site_id === auth.site.site_id)
      .map(formatLocation);

    return c.json({
      PaginationResponse: pagination(locations.length),
      Locations: locations,
    });
  });
}
