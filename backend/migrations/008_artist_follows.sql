-- Up Migration

CREATE TABLE echoroom.artist_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  follower_id UUID NOT NULL
    REFERENCES echoroom.users(id) ON DELETE CASCADE,

  artist_id UUID NOT NULL
    REFERENCES echoroom.artist_profiles(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (follower_id, artist_id)
);

CREATE INDEX idx_artist_follows_artist_id
  ON echoroom.artist_follows(artist_id);

CREATE INDEX idx_artist_follows_follower_id
  ON echoroom.artist_follows(follower_id);

-- Down Migration

DROP TABLE echoroom.artist_follows;