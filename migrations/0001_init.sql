-- DMC Navigator - init schema (MVP, proširivo)

-- AGENCIJE
CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- KORISNICI (AGENTI)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ČLANSTVO U AGENCIJI + ROLE
-- role: OWNER | ADMIN | AGENT
CREATE TABLE IF NOT EXISTS agency_members (
  agency_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN','AGENT')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (agency_id, user_id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ITINERARI (pod agencijom i pod agentom kroz owner_user_id)
-- status: DRAFT | PUBLISHED | ARCHIVED
CREATE TABLE IF NOT EXISTS itineraries (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id),
  UNIQUE (agency_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_itineraries_owner ON itineraries(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_agency ON itineraries(agency_id);

-- SURADNICI NA ITINERARU (timski rad)
-- role: OWNER | EDITOR | VIEWER
CREATE TABLE IF NOT EXISTS itinerary_members (
  itinerary_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER','EDITOR','VIEWER')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (itinerary_id, user_id),
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- DROPDOWNOVI PO ITINERARU
CREATE TABLE IF NOT EXISTS dropdowns (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(id)
);

CREATE TABLE IF NOT EXISTS dropdown_items (
  id TEXT PRIMARY KEY,
  dropdown_id TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (dropdown_id) REFERENCES dropdowns(id)
);

CREATE INDEX IF NOT EXISTS idx_dropdown_items_dropdown
ON dropdown_items(dropdown_id, sort_order);

-- ASSETI (PDF, slike...) metadata; datoteka je u R2
-- kind: PDF | IMAGE | FILE
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL,
  uploader_user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('PDF','IMAGE','FILE')),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(id),
  FOREIGN KEY (uploader_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_assets_itinerary ON assets(itinerary_id);
