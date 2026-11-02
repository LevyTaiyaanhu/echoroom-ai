-- Up Migration

CREATE SCHEMA echoroom;

REVOKE ALL ON SCHEMA echoroom FROM PUBLIC;
REVOKE ALL ON SCHEMA echoroom FROM anon, authenticated;

CREATE TABLE echoroom.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  full_name TEXT NOT NULL
    CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 100),

  email TEXT NOT NULL UNIQUE
    CHECK (
      email = lower(btrim(email))
      AND char_length(email) BETWEEN 3 AND 254
    ),

  password_hash TEXT NOT NULL
    CHECK (char_length(password_hash) > 0),

  role TEXT NOT NULL DEFAULT 'fan'
    CHECK (role IN ('fan', 'promoter', 'admin')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE echoroom.promoter_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL UNIQUE
    REFERENCES echoroom.users(id) ON DELETE CASCADE,

  display_name TEXT NOT NULL
    CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 100),

  bio TEXT
    CHECK (bio IS NULL OR char_length(bio) <= 2000),

  city TEXT
    CHECK (
      city IS NULL
      OR char_length(btrim(city)) BETWEEN 1 AND 100
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE echoroom.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE echoroom.promoter_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA echoroom
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION echoroom.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON echoroom.users
FOR EACH ROW
EXECUTE FUNCTION echoroom.set_updated_at();

CREATE TRIGGER promoter_profiles_set_updated_at
BEFORE UPDATE ON echoroom.promoter_profiles
FOR EACH ROW
EXECUTE FUNCTION echoroom.set_updated_at();

-- Down Migration

DROP TABLE echoroom.promoter_profiles;
DROP TABLE echoroom.users;
DROP FUNCTION echoroom.set_updated_at();
DROP SCHEMA echoroom;