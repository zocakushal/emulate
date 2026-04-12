import { Store, type Collection } from "@internal/core";
import type { GoogleUser, GoogleOAuthClient, GbpAccount, GbpLocation, GbpAttribute, GbpMedia, GbpReview, GbpLocalPost, GbpQuestion, GbpAnswer, GbpPlaceActionLink, GbpNotificationSetting, GbpAdmin } from "./entities.js";

export interface GoogleStore {
  users: Collection<GoogleUser>;
  oauthClients: Collection<GoogleOAuthClient>;
  gbpAccounts: Collection<GbpAccount>;
  gbpLocations: Collection<GbpLocation>;
  gbpAttributes: Collection<GbpAttribute>;
  gbpMedia: Collection<GbpMedia>;
  gbpReviews: Collection<GbpReview>;
  gbpLocalPosts: Collection<GbpLocalPost>;
  gbpQuestions: Collection<GbpQuestion>;
  gbpAnswers: Collection<GbpAnswer>;
  gbpPlaceActionLinks: Collection<GbpPlaceActionLink>;
  gbpNotificationSettings: Collection<GbpNotificationSetting>;
  gbpAdmins: Collection<GbpAdmin>;
}

export function getGoogleStore(store: Store): GoogleStore {
  return {
    users: store.collection<GoogleUser>("google.users", ["uid", "email"]),
    oauthClients: store.collection<GoogleOAuthClient>("google.oauth_clients", ["client_id"]),
    gbpAccounts: store.collection<GbpAccount>("google.gbp_accounts", ["account_id"]),
    gbpLocations: store.collection<GbpLocation>("google.gbp_locations", ["location_id", "account_id"]),
    gbpAttributes: store.collection<GbpAttribute>("google.gbp_attributes", ["location_name"]),
    gbpMedia: store.collection<GbpMedia>("google.gbp_media", ["media_id", "location_name"]),
    gbpReviews: store.collection<GbpReview>("google.gbp_reviews", ["review_id", "location_name"]),
    gbpLocalPosts: store.collection<GbpLocalPost>("google.gbp_local_posts", ["post_id", "location_name"]),
    gbpQuestions: store.collection<GbpQuestion>("google.gbp_questions", ["question_id", "location_name"]),
    gbpAnswers: store.collection<GbpAnswer>("google.gbp_answers", ["answer_id", "question_name"]),
    gbpPlaceActionLinks: store.collection<GbpPlaceActionLink>("google.gbp_place_action_links", ["link_id", "location_name"]),
    gbpNotificationSettings: store.collection<GbpNotificationSetting>("google.gbp_notification_settings", ["account_id"]),
    gbpAdmins: store.collection<GbpAdmin>("google.gbp_admins", ["admin_id", "parent_name"]),
  };
}
