export default function Admin() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Admin (MVP)</h1>
      <p>
        U ovom starteru API je spreman za osnovne operacije bez autentifikacije.
        U sljedećem koraku dodajemo login i provjere dozvola.
      </p>
      <ul>
        <li><code>GET /api/admin/itineraries?ownerUserId=...</code></li>
        <li><code>POST /api/admin/itineraries</code></li>
        <li><code>POST/PUT/DELETE /api/admin/dropdown-items</code></li>
      </ul>
    </main>
  );
}
