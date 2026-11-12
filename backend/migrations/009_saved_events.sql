-- Up Migration

CREATE TABLE echoroom.saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES echoroom.users(id) ON DELETE CASCADE,

  event_id UUID NOT NULL
    REFERENCES echoroom.events(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, event_id)
);

CREATE INDEX idx_saved_events_user_id
  ON echoroom.saved_events(user_id);

CREATE INDEX idx_saved_events_event_id
  ON echoroom.saved_events(event_id);

-- Down Migration

DROP TABLE echoroom.saved_events;