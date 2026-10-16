-- TenderLens Feature 1: projects table.
-- Money: NUMERIC(15,2) (never floating point). Dates: DATE (calendar dates, no timezone).
-- Timestamps: TIMESTAMPTZ. organization_id is reserved for future org-based ownership and
-- is intentionally nullable and NOT exposed by the API in Feature 1 (no auth/org model exists yet).
-- is_demo marks clearly-labelled demo rows; it can only be set by the dev seed script.

CREATE TABLE projects (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT           NOT NULL CHECK (char_length(name) BETWEEN 3 AND 120),
  project_type             TEXT           NOT NULL CHECK (project_type IN
    ('building_renovation','interior_fitout','civil_works','electrical_works','plumbing_works','other')),
  client_name              TEXT           NOT NULL CHECK (char_length(client_name) BETWEEN 2 AND 120),
  location_city            TEXT           NOT NULL CHECK (char_length(location_city) BETWEEN 1 AND 80),
  location_state           TEXT           NOT NULL CHECK (char_length(location_state) BETWEEN 1 AND 80),
  location_postal_code     TEXT           NULL CHECK (location_postal_code IS NULL OR char_length(location_postal_code) BETWEEN 3 AND 10),
  description              TEXT           NULL CHECK (description IS NULL OR char_length(description) <= 2000),
  planned_budget           NUMERIC(15,2)  NOT NULL CHECK (planned_budget > 0),
  currency                 CHAR(3)        NOT NULL CHECK (currency IN ('INR','USD','EUR','GBP','AED')),
  contingency_budget       NUMERIC(15,2)  NULL CHECK (contingency_budget IS NULL OR contingency_budget >= 0),
  planned_start_date       DATE           NOT NULL,
  target_completion_date   DATE           NOT NULL,
  status                   TEXT           NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','planning','active','on_hold','completed','cancelled')),
  is_demo                  BOOLEAN        NOT NULL DEFAULT FALSE,
  organization_id          UUID           NULL,
  idempotency_key          TEXT           NULL UNIQUE,
  created_at               TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT projects_dates_ordered CHECK (target_completion_date >= planned_start_date)
);

CREATE INDEX projects_status_idx          ON projects (status);
CREATE INDEX projects_created_at_idx      ON projects (created_at DESC);
CREATE INDEX projects_target_date_idx     ON projects (target_completion_date);
CREATE INDEX projects_organization_id_idx ON projects (organization_id);
