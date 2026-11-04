-- Up Migration

CREATE TYPE echoroom.event_status AS ENUM ('draft', 'active', 'cancelled', 'archived');

CREATE TYPE echoroom.event_label AS ENUM ('posted_by_promoter', 'unconfirmed', 'verified');

CREATE TABLE echoroom.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  promoter_id UUID NOT NULL
    REFERENCES echoroom.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),

  description TEXT
    CHECK (description IS NULL OR char_length(description) <= 5000),

  artists TEXT[] NOT NULL DEFAULT '{}',

  venue TEXT NOT NULL
    CHECK (char_length(btrim(venue)) BETWEEN 1 AND 200),

  city TEXT NOT NULL
    CHECK (char_length(btrim(city)) BETWEEN 1 AND 100),

  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,

  host TEXT
    CHECK (host IS NULL OR char_length(btrim(host)) BETWEEN 1 AND 200),

  ticket_price_info TEXT
    CHECK (ticket_price_info IS NULL OR char_length(ticket_price_info) <= 500),

  booking_info TEXT
    CHECK (booking_info IS NULL OR char_length(booking_info) <= 500),

  status echoroom.event_status NOT NULL DEFAULT 'active',
  label echoroom.event_label NOT NULL DEFAULT 'posted_by_promoter',

  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES echoroom.users(id) ON DELETE SET NULL,
  verification_invalidated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (end_at > start_at)
);

CREATE INDEX idx_events_promoter_id ON echoroom.events(promoter_id);
CREATE INDEX idx_events_status ON echoroom.events(status);
CREATE INDEX idx_events_start_at ON echoroom.events(start_at);
CREATE INDEX idx_events_city ON echoroom.events(city);

CREATE FUNCTION echoroom.events_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_set_updated_at
BEFORE UPDATE ON echoroom.events
FOR EACH ROW
EXECUTE FUNCTION echoroom.events_set_updated_at();

-- Down Migration

DROP TRIGGER IF EXISTS events_set_updated_at ON echoroom.events;
DROP FUNCTION IF EXISTS echoroom.events_set_updated_at();
DROP TABLE echoroom.events;
DROP TYPE echoroom.event_label;
DROP TYPE echoroom.event_status;