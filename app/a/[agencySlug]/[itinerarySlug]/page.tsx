export const runtime = "edge";

type PublicResponse = {
  agency: { id: string; name: string; slug: string };
  itinerary: { id: string; title: string; slug: string; status: string; description?: string | null };
  dropdowns: { id: string; name: string; items: { id: string; label: string; value: string; sort_order: number }[] }[];
  assets: { id: string; kind: string; filename: string; mime_type: string; r2_key: string; size_bytes: number; is_primary: number }[];
};

async function getData(agencySlug: string, itinerarySlug: string): Promise<PublicResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/public/${agencySlug}/${itinerarySlug}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Ne mogu dohvatiti itinerar.");
  return res.json();
}

export default async function PublicItinerary({ params }: { params: { agencySlug: string; itinerarySlug: string } }) {
  const data = await getData(params.agencySlug, params.itinerarySlug);

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ marginTop: 0 }}>{data.itinerary.title}</h1>
      {data.itinerary.description ? <p>{data.itinerary.description}</p> : null}

      <h2>Dropdownovi</h2>
      {data.dropdowns.length === 0 ? <p>Nema dropdownova.</p> : null}
      {data.dropdowns.map((dd) => (
        <section key={dd.id} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{dd.name}</div>
          <select style={{ padding: 8, minWidth: 280 }}>
            {dd.items.map((it) => (
              <option key={it.id} value={it.value}>
                {it.label}
              </option>
            ))}
          </select>
        </section>
      ))}

      <h2>Dokumenti</h2>
      {data.assets.length === 0 ? <p>Nema dokumenata.</p> : null}
      <ul>
        {data.assets.map((a) => (
          <li key={a.id}>
            {a.kind}: {a.filename} ({Math.round(a.size_bytes / 1024)} KB)
            <span style={{ opacity: 0.7 }}> — R2 key: {a.r2_key}</span>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 24, opacity: 0.7 }}>
        Napomena: u MVP-u još ne generiramo potpisane URL-ove za download iz R2. To dodajemo kad spojimo R2 binding.
      </p>
    </main>
  );
}
