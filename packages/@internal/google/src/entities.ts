import type { Entity } from "@internal/core";

export interface GoogleUser extends Entity {
  uid: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string | null;
  email_verified: boolean;
  locale: string;
}

export interface GoogleOAuthClient extends Entity {
  client_id: string;
  client_secret: string;
  name: string;
  redirect_uris: string[];
}

export type GbpVerificationState = "COMPLETED" | "PENDING_VERIFICATION" | "UNVERIFIED";

export interface GbpAccount extends Entity {
  account_id: string;
  name: string;
  account_name: string;
  type: "PERSONAL" | "LOCATION_GROUP" | "ORGANIZATION";
}

export interface GbpLocation extends Entity {
  location_id: string;
  account_id: string;
  name: string;
  title: string;
  store_code: string | null;
  language_code: string;
  phone_numbers: { primaryPhone?: string; additionalPhones?: string[] } | null;
  categories: { primaryCategory?: { name: string; displayName?: string }; additionalCategories?: Array<{ name: string; displayName?: string }> } | null;
  storefront_address: {
    regionCode?: string;
    languageCode?: string;
    postalCode?: string;
    administrativeArea?: string;
    locality?: string;
    addressLines?: string[];
  } | null;
  website_uri: string | null;
  regular_hours: unknown | null;
  special_hours: unknown | null;
  service_area: unknown | null;
  labels: string[] | null;
  latlng: { latitude: number; longitude: number } | null;
  open_info: { status?: "OPEN" | "CLOSED_PERMANENTLY" | "CLOSED_TEMPORARILY"; canReopen?: boolean } | null;
  metadata: Record<string, unknown> | null;
  profile: { description?: string } | null;
  relationship_data: unknown | null;
  more_hours: unknown | null;
  service_items: unknown | null;
  ad_words_location_extensions: unknown | null;
  verification_state: GbpVerificationState;
  has_voice_of_merchant: boolean;
  has_business_authority: boolean;
}

export interface GbpAttribute extends Entity {
  location_name: string; // e.g. "locations/123"
  attributes: any[];
  name: string; // "locations/123/attributes"
}

export interface GbpMedia extends Entity {
  media_id: string;
  location_name: string;
  name: string;
  mediaFormat: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
}

export interface GbpReview extends Entity {
  review_id: string;
  location_name: string;
  name: string;
  reviewer: { displayName?: string; isAnonymous?: boolean };
  starRating: string;
  comment: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
}

export interface GbpLocalPost extends Entity {
  post_id: string;
  location_name: string;
  name: string;
  languageCode: string;
  summary: string;
  state: string;
  event?: any;
  offer?: any;
  createTime: string;
  updateTime: string;
}

export interface GbpQuestion extends Entity {
  question_id: string;
  location_name: string;
  name: string;
  author: { displayName?: string };
  text: string;
  createTime: string;
  updateTime: string;
  upvoteCount: number;
}

export interface GbpAnswer extends Entity {
  answer_id: string;
  question_name: string; // e.g. "locations/123/questions/456"
  name: string;
  author: { displayName?: string; type?: string };
  text: string;
  createTime: string;
  updateTime: string;
  upvoteCount: number;
}

export interface GbpPlaceActionLink extends Entity {
  link_id: string;
  location_name: string;
  name: string;
  uri: string;
  placeActionType: string;
  providerType?: string;
  isEditable?: boolean;
}

export interface GbpNotificationSetting extends Entity {
  account_id: string;
  name: string;
  pubsubTopic: string;
  notificationTypes: string[];
}

export interface GbpAdmin extends Entity {
  admin_id: string;
  parent_name: string; // can be account or location name
  name: string;
  adminName: string;
  role: string;
  pendingInvitation: boolean;
}
