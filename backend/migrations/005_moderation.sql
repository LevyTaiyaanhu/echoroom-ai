-- Up Migration

CREATE TYPE echoroom.report_status AS ENUM ('open', 'reviewed', 'dismissed');

CREATE TABLE echoroom.event_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id UUID NOT NULL
    REFERENCES echoroom.events(id) ON DELETE CASCADE,

  reporter_id UUID NOT NULL
    REFERENCES echoroom.users(id) ON DELETE CASCADE,

  reason TEXT NOT NULL
    CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),

  description TEXT
    CHECK (description IS NULL OR char_length(description) <= 2000),

  status echoroom.report_status NOT NULL DEFAULT 'open',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES echoroom.users(id) ON DELETE SET NULL,

  UNIQUE (event_id, reporter_id)
);

CREATE INDEX idx_event_reports_event_id ON echoroom.event_reports(event_id);
CREATE INDEX idx_event_reports_status ON echoroom.event_reports(status);

CREATE TABLE echoroom.moderation_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id UUID NOT NULL
    REFERENCES echoroom.events(id) ON DELETE CASCADE,

  decided_by UUID NOT NULL
    REFERENCES echoroom.users(id) ON DELETE SET NULL,

  decision TEXT NOT NULL
    CHECK (decision IN ('hide', 'unhide', 'verify', 'unverify')),

  public_note TEXT
    CHECK (public_note IS NULL OR char_length(public_note) <= 1000),

  private_note TEXT
    CHECK (private_note IS NULL OR char_length(private_note) <= 4000),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_moderation_decisions_event_id ON echoroom.moderation_decisions(event_id);

ALTER TABLE echoroom.events ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_events_is_hidden ON echoroom.events(is_hidden);

-- Down Migration

ALTER TABLE echoroom.events DROP COLUMN IF EXISTS is_hidden;
DROP TABLE echoroom.moderation_decisions;
DROP TABLE echoroom.event_reports;
DROP TYPE echoroom.report_status;