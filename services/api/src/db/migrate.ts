import { pool } from '../lib/db';

const migrations = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'listener' CHECK (role IN ('listener', 'broadcaster', 'moderator', 'admin')),
  display_name VARCHAR(100),
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcaster_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  description TEXT DEFAULT '',
  is_live BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  listener_count INTEGER DEFAULT 0,
  peak_listeners INTEGER DEFAULT 0,
  stream_key VARCHAR(64) UNIQUE NOT NULL,
  mount_point VARCHAR(100) NOT NULL DEFAULT '/live',
  bitrate INTEGER DEFAULT 192,
  genre VARCHAR(50),
  website_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id),
  user_id UUID NOT NULL REFERENCES users(id),
  username VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_moderator BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS chat_bans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id),
  user_id UUID NOT NULL REFERENCES users(id),
  banned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broadcast_id, user_id)
);

CREATE TABLE IF NOT EXISTS stream_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id),
  artist VARCHAR(200),
  title VARCHAR(200),
  album VARCHAR(200),
  cover_url VARCHAR(500),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_is_live ON broadcasts(is_live);
CREATE INDEX IF NOT EXISTS idx_broadcasts_broadcaster_id ON broadcasts(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_broadcast_id ON chat_messages(broadcast_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_bans_broadcast_user ON chat_bans(broadcast_id, user_id);
`;

async function migrate() {
  console.log('Running database migrations...');
  try {
    await pool.query(migrations);
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
