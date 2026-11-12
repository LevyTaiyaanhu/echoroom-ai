-- Up Migration

-- Add 'artist' role to users table
ALTER TABLE echoroom.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE echoroom.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('fan', 'promoter', 'artist', 'admin'));

-- Create artist profiles table
CREATE TABLE echoroom.artist_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL UNIQUE
    REFERENCES echoroom.users(id) ON DELETE CASCADE,

  stage_name TEXT NOT NULL
    CHECK (char_length(btrim(stage_name)) BETWEEN 2 AND 100),

  genre TEXT
    CHECK (genre IS NULL OR char_length(btrim(genre)) BETWEEN 1 AND 100),

  bio TEXT
    CHECK (bio IS NULL OR char_length(bio) <= 2000),

  city TEXT
    CHECK (
      city IS NULL
      OR char_length(btrim(city)) BETWEEN 1 AND 100
    ),

  profile_picture_url TEXT
    CHECK (profile_picture_url IS NULL OR char_length(profile_picture_url) <= 500),

  is_private BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE echoroom.artist_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA echoroom
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION echoroom.artist_profiles_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER artist_profiles_set_updated_at
BEFORE UPDATE ON echoroom.artist_profiles
FOR EACH ROW
EXECUTE FUNCTION echoroom.artist_profiles_set_updated_at();

-- Down Migration

DROP TRIGGER IF EXISTS artist_profiles_set_updated_at ON echoroom.artist_profiles;
DROP FUNCTION IF EXISTS echoroom.artist_profiles_set_updated_at();
DROP TABLE echoroom.artist_profiles;

ALTER TABLE echoroom.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE echoroom.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('fan', 'promoter', 'admin'));