import { Store, type Collection } from "@internal/core";
import type {
  GlossgeniusAppointment,
  GlossgeniusBusiness,
  GlossgeniusPortfolioImage,
  GlossgeniusProvider,
  GlossgeniusReview,
  GlossgeniusService,
} from "./entities.js";

export interface GlossgeniusStore {
  businesses: Collection<GlossgeniusBusiness>;
  appointments: Collection<GlossgeniusAppointment>;
  services: Collection<GlossgeniusService>;
  providers: Collection<GlossgeniusProvider>;
  reviews: Collection<GlossgeniusReview>;
  portfolioImages: Collection<GlossgeniusPortfolioImage>;
}

export function getGlossgeniusStore(store: Store): GlossgeniusStore {
  return {
    businesses: store.collection<GlossgeniusBusiness>("glossgenius.businesses", ["slug", "access_token"]),
    appointments: store.collection<GlossgeniusAppointment>("glossgenius.appointments", ["guid", "business_slug", "appointment_token"]),
    services: store.collection<GlossgeniusService>("glossgenius.services", ["guid", "business_slug", "provider_guid"]),
    providers: store.collection<GlossgeniusProvider>("glossgenius.providers", ["guid", "business_slug", "token"]),
    reviews: store.collection<GlossgeniusReview>("glossgenius.reviews", ["business_slug"]),
    portfolioImages: store.collection<GlossgeniusPortfolioImage>("glossgenius.portfolio_images", ["guid", "business_slug"]),
  };
}
