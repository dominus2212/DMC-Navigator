-- RBAC constraints (indexes only, role columns already exist)

-- Jedan user jednom u agenciji
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_members_unique
ON agency_members(agency_id, user_id);

-- Jedan user jednom u itineraru
CREATE UNIQUE INDEX IF NOT EXISTS idx_itinerary_members_unique
ON itinerary_members(itinerary_id, user_id);

-- Unique slug per itinerary
CREATE UNIQUE INDEX IF NOT EXISTS idx_itinerary_pages_slug_unique
ON itinerary_pages(itinerary_id, slug);
