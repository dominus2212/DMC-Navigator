export type AgencyRole = "OWNER" | "ADMIN" | "AGENT";
export type ItineraryRole = "OWNER" | "EDITOR" | "VIEWER";

export type Action =
  | "agency.users.create"
  | "agency.users.list"
  | "agency.users.update"
  | "itinerary.create"
  | "itinerary.list"
  | "itinerary.read"
  | "itinerary.update"
  | "itinerary.publish"
  | "itinerary.archive"
  | "page.create"
  | "page.list"
  | "page.update"
  | "page.reorder"
  | "page.publish";

export const AGENCY_PERMISSIONS: Record<Action, AgencyRole[]> = {
  "agency.users.create": ["OWNER", "ADMIN"],
  "agency.users.list": ["OWNER", "ADMIN"],
  "agency.users.update": ["OWNER"],

  "itinerary.create": ["OWNER", "ADMIN", "AGENT"],
  "itinerary.list": ["OWNER", "ADMIN", "AGENT"],
  "itinerary.read": ["OWNER", "ADMIN", "AGENT"],
  "itinerary.update": ["OWNER", "ADMIN", "AGENT"],
  "itinerary.publish": ["OWNER", "ADMIN", "AGENT"],
  "itinerary.archive": ["OWNER", "ADMIN"],

  "page.create": ["OWNER", "ADMIN", "AGENT"],
  "page.list": ["OWNER", "ADMIN", "AGENT"],
  "page.update": ["OWNER", "ADMIN", "AGENT"],
  "page.reorder": ["OWNER", "ADMIN", "AGENT"],
  "page.publish": ["OWNER", "ADMIN", "AGENT"],
};

export const ITINERARY_PERMISSIONS: Partial<Record<Action, ItineraryRole[]>> = {
  "itinerary.update": ["OWNER", "EDITOR"],
  "itinerary.publish": ["OWNER"],
  "itinerary.archive": ["OWNER"],

  "page.create": ["OWNER", "EDITOR"],
  "page.update": ["OWNER", "EDITOR"],
  "page.reorder": ["OWNER", "EDITOR"],
  "page.publish": ["OWNER"],
};
