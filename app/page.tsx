export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ margin: 0 }}>DMC Navigator</h1>
      <p style={{ maxWidth: 720 }}>
        Ovo je starter za Navigator. Public itinerar endpoint je:
        <code> /api/public/&lt;agencySlug&gt;/&lt;itinerarySlug&gt; </code>
      </p>
      <p>
        Primjer (nakon local seeda): <code>/api/public/demo-dmc/mercedes-2025</code>
      </p>
    </main>
  );
}
