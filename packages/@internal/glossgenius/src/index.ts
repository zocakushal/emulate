import type { Hono } from "hono";
import type { AppEnv, RouteContext, ServicePlugin, Store, TokenMap, WebhookDispatcher } from "@internal/core";
import { addMinutes, generateAccessToken, generateGuid } from "./helpers.js";
import { getGlossgeniusStore } from "./store.js";
import { appointmentsRoutes } from "./routes/appointments.js";
import { webRoutes } from "./routes/web.js";

export { getGlossgeniusStore, type GlossgeniusStore } from "./store.js";
export * from "./entities.js";

export interface GlossgeniusSeedConfig {
  port?: number;
  businesses?: Array<{
    slug: string;
    name: string;
    access_token?: string;
  }>;
  appointments?: Array<{
    business_slug: string;
    provider_guid?: string;
    service_guids?: string[];
    client_name: string;
    client_email?: string;
    client_phone: string;
    start_time: string;
    status?: string;
  }>;
  services?: Array<{
    name: string;
    price: string;
    duration: number;
    business_slug: string;
    description?: string;
    category?: string;
    provider_guid?: string;
    image?: string;
  }>;
  providers?: Array<{
    name: string;
    business_slug: string;
    email?: string;
    color?: string;
    bio?: string;
  }>;
  reviews?: Array<{
    rating: number;
    message: string;
    reviewer_name: string;
    business_slug: string;
    published_at?: string;
  }>;
  portfolio_images?: Array<{
    business_slug: string;
    url: string;
    caption?: string;
  }>;
}

function seedDefaults(store: Store, _baseUrl: string): void {
  const gs = getGlossgeniusStore(store);
  const business = gs.businesses.insert({
    slug: "test-salon",
    name: "Test Salon",
    access_token: generateAccessToken("test-salon"),
    booking_url: "https://book.glossgenius.com/test-salon",
  });

  const provider = gs.providers.insert({
    business_slug: business.slug,
    guid: generateGuid("provider"),
    token: generateGuid("member"),
    name: "Jane Doe",
    email: "jane@example.com",
    color: "#111111",
    bio: null,
  });

  const service = gs.services.insert({
    business_slug: business.slug,
    guid: generateGuid("service"),
    token: generateGuid("service_token"),
    name: "Haircut",
    description: "Classic precision haircut",
    price: "50.00",
    duration: 45,
    category_name: "Hair",
    image: "https://images.emulate.dev/glossgenius/haircut.jpg",
    online_bookable: true,
    provider_guid: provider.guid,
  });

  gs.reviews.insert({
    business_slug: business.slug,
    rating: 5,
    message: "Great service!",
    reviewer_name: "Happy Client",
    published_at: new Date().toISOString(),
  });

  gs.portfolioImages.insert({
    business_slug: business.slug,
    guid: generateGuid("portfolio"),
    url: "https://images.emulate.dev/glossgenius/portfolio-1.jpg",
    caption: "Fresh cut",
  });

  const startTime = new Date();
  startTime.setUTCDate(startTime.getUTCDate() + 1);
  startTime.setUTCHours(15, 0, 0, 0);

  gs.appointments.insert({
    business_slug: business.slug,
    guid: generateGuid("appt"),
    appointment_token: generateGuid("appt_token"),
    provider_guid: provider.guid,
    client_id: 1,
    client_name: "John Doe",
    client_email: "john@example.com",
    client_phone: "+15551234567",
    start_time: startTime.toISOString(),
    end_time: addMinutes(startTime.toISOString(), service.duration),
    total_price: service.price,
    status: "confirmed",
    service_guids: [service.guid],
  });
}

export function seedFromConfig(store: Store, _baseUrl: string, config: GlossgeniusSeedConfig): void {
  const gs = getGlossgeniusStore(store);

  if (config.businesses) {
    for (const business of config.businesses) {
      if (gs.businesses.findOneBy("slug", business.slug)) continue;
      gs.businesses.insert({
        slug: business.slug,
        name: business.name,
        access_token: business.access_token ?? generateAccessToken(business.slug),
        booking_url: `https://book.glossgenius.com/${business.slug}`,
      });
    }
  }

  if (config.providers) {
    for (const provider of config.providers) {
      const business = gs.businesses.findOneBy("slug", provider.business_slug);
      if (!business) continue;
      const existing = gs.providers
        .all()
        .find((item) => item.business_slug === provider.business_slug && item.name === provider.name);
      if (existing) continue;
      gs.providers.insert({
        business_slug: provider.business_slug,
        guid: generateGuid("provider"),
        token: generateGuid("member"),
        name: provider.name,
        email: provider.email ?? null,
        color: provider.color ?? "#111111",
        bio: provider.bio ?? null,
      });
    }
  }

  if (config.services) {
    for (const service of config.services) {
      const business = gs.businesses.findOneBy("slug", service.business_slug);
      if (!business) continue;
      const existing = gs.services
        .all()
        .find((item) => item.business_slug === service.business_slug && item.name === service.name);
      if (existing) continue;
      const provider =
        (service.provider_guid ? gs.providers.findOneBy("guid", service.provider_guid) : null) ??
        gs.providers.all().find((item) => item.business_slug === service.business_slug) ??
        null;
      gs.services.insert({
        business_slug: service.business_slug,
        guid: generateGuid("service"),
        token: generateGuid("service_token"),
        name: service.name,
        description: service.description ?? "",
        price: service.price,
        duration: service.duration,
        category_name: service.category ?? "Services",
        image: service.image ?? null,
        online_bookable: true,
        provider_guid: provider?.guid ?? null,
      });
    }
  }

  if (config.reviews) {
    for (const review of config.reviews) {
      const business = gs.businesses.findOneBy("slug", review.business_slug);
      if (!business) continue;
      gs.reviews.insert({
        business_slug: review.business_slug,
        rating: review.rating,
        message: review.message,
        reviewer_name: review.reviewer_name,
        published_at: review.published_at ?? new Date().toISOString(),
      });
    }
  }

  if (config.portfolio_images) {
    for (const image of config.portfolio_images) {
      const business = gs.businesses.findOneBy("slug", image.business_slug);
      if (!business) continue;
      gs.portfolioImages.insert({
        business_slug: image.business_slug,
        guid: generateGuid("portfolio"),
        url: image.url,
        caption: image.caption ?? null,
      });
    }
  }

  if (config.appointments) {
    for (const appointment of config.appointments) {
      const business = gs.businesses.findOneBy("slug", appointment.business_slug);
      if (!business) continue;
      const provider =
        (appointment.provider_guid ? gs.providers.findOneBy("guid", appointment.provider_guid) : null) ??
        gs.providers.all().find((item) => item.business_slug === appointment.business_slug);
      const serviceGuids =
        appointment.service_guids && appointment.service_guids.length > 0
          ? appointment.service_guids
          : gs.services
              .all()
              .filter((item) => item.business_slug === appointment.business_slug)
              .slice(0, 1)
              .map((item) => item.guid);
      const firstService = serviceGuids
        .map((guid) => gs.services.findOneBy("guid", guid))
        .find((service): service is NonNullable<typeof service> => Boolean(service));
      gs.appointments.insert({
        business_slug: appointment.business_slug,
        guid: generateGuid("appt"),
        appointment_token: generateGuid("appt_token"),
        provider_guid: provider?.guid ?? "",
        client_id: gs.appointments.count() + 1,
        client_name: appointment.client_name,
        client_email: appointment.client_email ?? null,
        client_phone: appointment.client_phone,
        start_time: appointment.start_time,
        end_time: addMinutes(appointment.start_time, firstService?.duration ?? 30),
        total_price: firstService?.price ?? "0.00",
        status: appointment.status ?? "confirmed",
        service_guids: serviceGuids,
      });
    }
  }
}

export const glossgeniusPlugin: ServicePlugin = {
  name: "glossgenius",
  register(app: Hono<AppEnv>, store: Store, webhooks: WebhookDispatcher, baseUrl: string, tokenMap?: TokenMap): void {
    const ctx: RouteContext = { app, store, webhooks, baseUrl, tokenMap };
    appointmentsRoutes(ctx);
    webRoutes(ctx);
  },
  seed(store: Store, baseUrl: string): void {
    seedDefaults(store, baseUrl);
  },
};

export default glossgeniusPlugin;
