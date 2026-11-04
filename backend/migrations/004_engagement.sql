-- Up Migration

CREATE TABLE echoroom.event_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES echoroom.users(id) ON DELETE CASCADE,

  event_id UUID NOT NULL
    REFERENCES echoroom.events(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, event_id)
);

CREATE INDEX idx_event_likes_event_id ON echoroom.event_likes(event_id);
CREATE INDEX idx_event_likes_user_id ON echoroom.event_likes(user_id);

CREATE TABLE echoroom.event_view_counts (
  event_id UUID PRIMARY KEY
    REFERENCES echoroom.events(id) ON DELETE CASCADE,

  view_count INTEGER NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE echoroom.event_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id UUID NOT NULL
    REFERENCES echoroom.events(id) ON DELETE CASCADE,

  shared_by UUID
    REFERENCES echoroom.users(id) ON DELETE SET NULL,

  platform TEXT
    CHECK (platform IS NULL OR char_length(btrim(platform)) BETWEEN 1 AND 50),

  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_shares_event_id ON echoroom.event_shares(event_id);

-- Down Migration

DROP TABLE echoroom.event_shares;
DROP TABLE echoroom.event_view_counts;
DROP TABLE echoroom.event_likes;