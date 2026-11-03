-- Up Migration

CREATE TABLE echoroom.promoter_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  follower_id UUID NOT NULL
    REFERENCES echoroom.users(id) ON DELETE CASCADE,

  promoter_id UUID NOT NULL
    REFERENCES echoroom.promoter_profiles(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (follower_id, promoter_id)
);

CREATE INDEX idx_promoter_follows_promoter_id
  ON echoroom.promoter_follows(promoter_id);

CREATE INDEX idx_promoter_follows_follower_id
  ON echoroom.promoter_follows(follower_id);

-- Down Migration

DROP TABLE echoroom.promoter_follows;