import { json, notFound } from "../../_lib/http";

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (ctx) => {
  const { agencySlug, itinerarySlug } = ctx.params;

  const agency = await ctx.env.DB
    .prepare("SELECT id FROM agencies WHERE slug = ?")
    .bind(agencySlug)
    .first<{ id: string }>();

  if (!agency) {
    return notFound("Agency not found");
  }

  const itinerary = await ctx.env.DB
    .prepare(
      "SELECT id, title, description, status FROM itineraries WHERE slug = ? AND agency_id = ?"
    )
    .bind(itinerarySlug, agency.id)
    .first();

  if (!itinerary) {
    return notFound("Itinerary not found");
  }

  const dropdowns = await ctx.env.DB
    .prepare("SELECT id, name FROM dropdowns WHERE itinerary_id = ?")
    .bind(itinerary.id)
    .all<{ id: string; name: string }>();

  const result = [];

  for (const dd of dropdowns.results) {
    const items = await ctx.env.DB
      .prepare(
        "SELECT id, label, value, sort_order FROM dropdown_items WHERE dropdown_id = ? AND active = 1 ORDER BY sort_order ASC"
      )
      .bind(dd.id)
      .all();

    result.push({
      ...dd,
      items: items.results,
    });
  }

  return json({
    itinerary,
    dropdowns: result,
  });
};
