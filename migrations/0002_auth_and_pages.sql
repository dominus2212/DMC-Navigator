-- 1) Auth: password hash
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- 2) Platform admin flag
ALTER TABLE users ADD COLUMN is_platform_admin INTEGER NOT NULL DEFAULT 0;

-- 3) Sessions (httpOnly cookie session)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 4) Itinerary pages (stranice unutar itinerara)
-- status: DRAFT | PUBLISHED
-- type: "PROGRAM" | "HOTELS" | "TRANSFERS" | "CUSTOM" (za početak samo CUSTOM)
CREATE TABLE IF NOT EXISTS itinerary_pages (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'CUSTOM',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  sort_order INTEGER NOT NULL DEFAULT 0,
  content_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(id),
  UNIQUE (itinerary_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_itinerary_pages ON itinerary_pages(itinerary_id, sort_order);
