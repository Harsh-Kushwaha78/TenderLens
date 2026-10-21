-- TenderLens Feature 2: Bill of Quantities (BOQ) and BOQ items. Forward-only; does not alter existing tables.
-- Precision: quantity NUMERIC(10,3) (max 9,999,999.999), rate NUMERIC(10,2) (max 99,999,999.99).
-- line_total is a GENERATED column = round(quantity * estimated_rate, 2) (half away from zero, i.e. half-up for
-- non-negatives), so the stored value can never disagree with the formula and clients cannot supply it.
-- A NULL estimated_rate means "not yet estimated" (NOT zero): line_total is NULL and excluded from totals.
-- boqs.currency is a snapshot of the project's currency at creation so later project edits cannot silently
-- reinterpret saved amounts. boqs.revision supports optimistic concurrency (PUT must send the revision it loaded).

CREATE TABLE boqs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title       TEXT        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 150),
  description TEXT        NULL CHECK (description IS NULL OR char_length(description) <= 2000),
  currency    CHAR(3)     NOT NULL CHECK (currency IN ('INR','USD','EUR','GBP','AED')),
  revision    INTEGER     NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX boqs_project_id_idx ON boqs (project_id, created_at DESC);

CREATE TABLE boq_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_id         UUID          NOT NULL REFERENCES boqs(id) ON DELETE CASCADE,
  position       INTEGER       NOT NULL CHECK (position >= 1),
  description    TEXT          NOT NULL CHECK (char_length(description) BETWEEN 1 AND 1000),
  specifications TEXT          NULL CHECK (specifications IS NULL OR char_length(specifications) <= 1000),
  quantity       NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  unit           TEXT          NOT NULL CHECK (unit IN
    ('m','m2','m3','sqft','kg','tonne','litre','piece','set','bag','day','lump_sum')),
  estimated_rate NUMERIC(10,2) NULL CHECK (estimated_rate IS NULL OR estimated_rate >= 0),
  line_total     NUMERIC(18,2) GENERATED ALWAYS AS (round(quantity * estimated_rate, 2)) STORED,
  source         TEXT          NOT NULL DEFAULT 'manual' CHECK (source IN ('manual')),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT boq_items_position_unique UNIQUE (boq_id, position) DEFERRABLE INITIALLY DEFERRED
);
