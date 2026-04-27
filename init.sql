-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password      VARCHAR(255),
  name          VARCHAR(100),
  role          VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         VARCHAR(512) UNIQUE NOT NULL,
  expires_at    TIMESTAMP NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  dialect       VARCHAR(50) NOT NULL DEFAULT 'PostgreSQL',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Schema tables
CREATE TABLE schema_tables (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  sort_order        INT NOT NULL DEFAULT 0
);

-- Columns
CREATE TABLE columns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id      UUID NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  nullable      BOOLEAN NOT NULL DEFAULT TRUE,
  key_type      VARCHAR(10) NOT NULL DEFAULT 'none',
  default_val   VARCHAR(255),
  sort_order    INT NOT NULL DEFAULT 0
);

-- Column references (FK relationships)
CREATE TABLE column_references (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id           UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  referenced_table    VARCHAR(100) NOT NULL,
  referenced_column   VARCHAR(100) NOT NULL
);

-- Messages
CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role              VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content           TEXT NOT NULL,
  sql_query         TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Rate limit log
CREATE TABLE rate_limit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_refresh_tokens_user_id 
  ON refresh_tokens(user_id);

CREATE INDEX idx_conversations_user_id 
  ON conversations(user_id);

CREATE INDEX idx_conversations_updated_at 
  ON conversations(updated_at DESC);

CREATE INDEX idx_schema_tables_conversation_id 
  ON schema_tables(conversation_id);

CREATE INDEX idx_columns_table_id 
  ON columns(table_id);

CREATE INDEX idx_column_references_column_id 
  ON column_references(column_id);

CREATE INDEX idx_messages_conversation_id 
  ON messages(conversation_id);

CREATE INDEX idx_messages_created_at 
  ON messages(conversation_id, created_at DESC);

CREATE INDEX idx_rate_limit_user_time 
  ON rate_limit_log(user_id, created_at DESC);

-- Auto-update updated_at on conversations
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();