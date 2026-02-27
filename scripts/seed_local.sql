-- Demo seed (LOCAL)
INSERT INTO agencies (id,name,slug) VALUES ('ag_1','Demo DMC','demo-dmc');

INSERT INTO users (id,email,full_name) VALUES
('u_owner','owner@demo.local','Owner Demo'),
('u_agent1','agent1@demo.local','Agent 1'),
('u_agent2','agent2@demo.local','Agent 2');

INSERT INTO agency_members (agency_id,user_id,role) VALUES
('ag_1','u_owner','OWNER'),
('ag_1','u_agent1','AGENT'),
('ag_1','u_agent2','AGENT');

INSERT INTO itineraries (id,agency_id,owner_user_id,title,slug,status,description)
VALUES
('it_1','ag_1','u_agent1','Mercedes-Benz Croatia 2025 Program','mercedes-2025','PUBLISHED','Demo itinerar'),
('it_2','ag_1','u_agent2','Incentive 2026 Program','incentive-2026','DRAFT','Demo draft itinerar');

INSERT INTO itinerary_members (itinerary_id,user_id,role) VALUES
('it_1','u_agent1','OWNER'),
('it_1','u_owner','EDITOR');

INSERT INTO dropdowns (id,itinerary_id,name) VALUES
('dd_1','it_1','Odabir paketa');

INSERT INTO dropdown_items (id,dropdown_id,label,value,sort_order,active) VALUES
('ddi_1','dd_1','Basic','basic',1,1),
('ddi_2','dd_1','Premium','premium',2,1);
