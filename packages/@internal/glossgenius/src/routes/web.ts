import type { RouteContext } from "@internal/core";
import {
  buildAvailableTimes,
  formatPortfolioImage,
  formatReview,
  resolveBusinessBySlug,
} from "../helpers.js";
import { getGlossgeniusStore } from "../store.js";

function queryList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.flatMap((item) => item.split(",")) : value.split(",");
}

export function webRoutes({ app, store }: RouteContext): void {
  const gs = getGlossgeniusStore(store);

  app.get("/v3/web/available_times", (c) => {
    const slug = c.req.query("slug");
    const business = resolveBusinessBySlug(gs, slug);
    if (!business) {
      return c.json({ data: [] }, 404);
    }

    const month = Math.max(1, Number(c.req.query("month") ?? new Date().getUTCMonth() + 1));
    const year = Math.max(2000, Number(c.req.query("year") ?? new Date().getUTCFullYear()));
    const serviceGuids = queryList(c.req.queries("service_guids[]") ?? c.req.query("service_guids[]"))
      .map((value) => value.trim())
      .filter(Boolean);
    const providerGuids = queryList(c.req.queries("provider_guids[]") ?? c.req.query("provider_guids[]"))
      .map((value) => value.trim())
      .filter(Boolean);

    const services = gs.services
      .all()
      .filter((service) => service.business_slug === business.slug)
      .filter((service) => serviceGuids.length === 0 || serviceGuids.includes(service.guid));
    const providers = gs.providers
      .all()
      .filter((provider) => provider.business_slug === business.slug)
      .filter((provider) => providerGuids.length === 0 || providerGuids.includes(provider.guid));

    return c.json(buildAvailableTimes(business, services, providers, month, year));
  });

  app.get("/v3/web/portfolio_images", (c) => {
    const business = resolveBusinessBySlug(gs, c.req.query("slug"));
    if (!business) {
      return c.json({ data: [] }, 404);
    }

    const limit = Math.max(1, Math.min(100, Number(c.req.query("limit") ?? "100")));
    const images = gs.portfolioImages
      .all()
      .filter((image) => image.business_slug === business.slug)
      .slice(0, limit)
      .map(formatPortfolioImage);

    return c.json({
      data: images,
      meta: {
        total: images.length,
      },
    });
  });

  app.get("/v3/web/reviews", (c) => {
    const business = resolveBusinessBySlug(gs, c.req.query("slug"));
    if (!business) {
      return c.json({ data: [] }, 404);
    }

    const limit = Math.max(1, Math.min(100, Number(c.req.query("limit") ?? "100")));
    const reviews = gs.reviews
      .all()
      .filter((review) => review.business_slug === business.slug)
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .slice(0, limit)
      .map(formatReview);

    return c.json({
      data: reviews,
      meta: {
        total: reviews.length,
      },
    });
  });
}
