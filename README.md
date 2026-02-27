# DMC Navigator (starter)

Ovo je starter struktura za **DMC Navigator** na Cloudflare stacku:
- Cloudflare Pages (Next.js)
- Cloudflare Pages Functions (API)
- Cloudflare D1 (SQL база)
- Cloudflare R2 (PDF/asset storage)

## Što je uključeno (MVP)
- Multi-tenant: agencije
- Agenti (users) unutar agencija
- Itinerari su **pod agentima** (owner_user_id) i pod agencijom (agency_id)
- Suradnici na itineraru (itinerary_members)
- Dropdownovi + stavke
- Asset metadata (PDF/FILE/IMAGE) za R2

## Preduvjeti
- Node.js 18+
- Cloudflare račun + `wrangler` instaliran (`npm i -g wrangler`)

## 1) Kreiraj D1 bazu
```bash
wrangler d1 create dmc_navigator_db
```
Zapiši `database_id`.

## 2) Uredi `wrangler.toml`
U `wrangler.toml` upiši svoj `database_id` (i po želji R2 bucket binding).

## 3) Primijeni migracije (lokalno)
```bash
wrangler d1 migrations apply dmc_navigator_db --local
```

## 4) (Opcionalno) Seed demo podataka (lokalno)
U `scripts/seed_local.sql` ima demo seed.

```bash
wrangler d1 execute dmc_navigator_db --local --file ./scripts/seed_local.sql
```

## 5) Pokreni dev
```bash
npm install
npm run dev
```

## 6) Deploy (Pages)
- Poveži repo na Cloudflare Pages.
- Postavi varijable/bindings prema `wrangler.toml`.
- Deploy.

## Napomena o autentifikaciji
Ovaj starter namjerno ne uključuje auth (da brže kreneš).
U idućem koraku se dodaje Auth (Auth.js/Clerk) i provjere dozvola na API endpointima.
