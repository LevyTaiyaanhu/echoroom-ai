-- Up Migration

CREATE TYPE echoroom.notification_type AS ENUM (
  'event_upcoming',
  'event_from_followed',
  'event_saved_changed',
  'reminder'
);

CREATE TABLE echoroom.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES echoroom.users(id) ON DELETE CASCADE,

  type echoroom.notification_type NOT NULL,

  title TEXT NOT NULL
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),

  message TEXT NOT NULL
    CHECK (char_length(btrim(message)) BETWEEN 1 AND 1000),

  event_id UUID
    REFERENCES echoroom.events(id) ON DELETE CASCADE,

  related_entity_type TEXT
    CHECK (related_entity_type IS NULL OR char_length(btrim(related_entity_type)) BETWEEN 1 AND 50),

  related_entity_id UUID,

  is_read BOOLEAN NOT NULL DEFAULT FALSE,

  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id
  ON echoroom.notifications(user_id);

CREATE INDEX idx_notifications_user_unread
  ON echoroom.notifications(user_id, is_read);

CREATE INDEX idx_notifications_event_id
  ON echoroom.notifications(event_id);

CREATE TABLE echoroom.notification_preferences (
  user_id UUID PRIMARY KEY
    REFERENCES echoroom.users(id) ON DELETE CASCADE,

  event_reminders BOOLEAN NOT NULL DEFAULT TRUE,

  new_events_from_followed BOOLEAN NOT NULL DEFAULT TRUE,

  saved_event_changes BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Down Migration

DROP TABLE echoroom.notification_preferences;
DROP TABLE echoroom.notifications;
DROP TYPE echoroom.notification_type;