import { onRequestGet as __api_admin_agency_itineraries_index_ts_onRequestGet } from "/Users/ljubopostenjak/Desktop/dmc-navigator-starter/functions/api/admin/agency/itineraries/index.ts"
import { onRequestPost as __api_admin_agency_itineraries_index_ts_onRequestPost } from "/Users/ljubopostenjak/Desktop/dmc-navigator-starter/functions/api/admin/agency/itineraries/index.ts"
import { onRequestGet as __api_admin_agency_ping_ts_onRequestGet } from "/Users/ljubopostenjak/Desktop/dmc-navigator-starter/functions/api/admin/agency/ping.ts"
import { onRequestGet as __api_public__agencySlug___itinerarySlug__ts_onRequestGet } from "/Users/ljubopostenjak/Desktop/dmc-navigator-starter/functions/api/public/[agencySlug]/[itinerarySlug].ts"
import { onRequestPost as __api_auth_login_ts_onRequestPost } from "/Users/ljubopostenjak/Desktop/dmc-navigator-starter/functions/api/auth/login.ts"
import { onRequestPost as __api_auth_logout_ts_onRequestPost } from "/Users/ljubopostenjak/Desktop/dmc-navigator-starter/functions/api/auth/logout.ts"
import { onRequestGet as __api_auth_me_ts_onRequestGet } from "/Users/ljubopostenjak/Desktop/dmc-navigator-starter/functions/api/auth/me.ts"

export const routes = [
    {
      routePath: "/api/admin/agency/itineraries",
      mountPath: "/api/admin/agency/itineraries",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_agency_itineraries_index_ts_onRequestGet],
    },
  {
      routePath: "/api/admin/agency/itineraries",
      mountPath: "/api/admin/agency/itineraries",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_agency_itineraries_index_ts_onRequestPost],
    },
  {
      routePath: "/api/admin/agency/ping",
      mountPath: "/api/admin/agency",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_agency_ping_ts_onRequestGet],
    },
  {
      routePath: "/api/public/:agencySlug/:itinerarySlug",
      mountPath: "/api/public/:agencySlug",
      method: "GET",
      middlewares: [],
      modules: [__api_public__agencySlug___itinerarySlug__ts_onRequestGet],
    },
  {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_login_ts_onRequestPost],
    },
  {
      routePath: "/api/auth/logout",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_logout_ts_onRequestPost],
    },
  {
      routePath: "/api/auth/me",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_me_ts_onRequestGet],
    },
  ]