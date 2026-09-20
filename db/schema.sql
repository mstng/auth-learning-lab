CREATE TABLE IF NOT EXISTS lab_spaces (
 id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
 id text PRIMARY KEY, lab_id text NOT NULL REFERENCES lab_spaces(id) ON DELETE CASCADE,
 email text NOT NULL, password_hash text NOT NULL,
 role text NOT NULL CHECK (role IN ('user','admin')),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(lab_id,email), UNIQUE(lab_id,id)
);
CREATE TABLE IF NOT EXISTS sessions (
 id text PRIMARY KEY, lab_id text NOT NULL REFERENCES lab_spaces(id) ON DELETE CASCADE,
 user_id text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (lab_id,user_id) REFERENCES users(lab_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS sessions_lab_idx ON sessions(lab_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
-- Future phases: no tokens or codes are issued in PHASE 1-6.
CREATE TABLE IF NOT EXISTS refresh_tokens (
 id text PRIMARY KEY, lab_id text NOT NULL REFERENCES lab_spaces(id) ON DELETE CASCADE,
 user_id text NOT NULL, token_hash text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
 FOREIGN KEY (lab_id,user_id) REFERENCES users(lab_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS oauth_clients (
 client_id text PRIMARY KEY, lab_id text NOT NULL REFERENCES lab_spaces(id) ON DELETE CASCADE,
 client_name text NOT NULL, redirect_uri text NOT NULL
);
CREATE TABLE IF NOT EXISTS authorization_codes (
 code text PRIMARY KEY, lab_id text NOT NULL REFERENCES lab_spaces(id) ON DELETE CASCADE,
 client_id text NOT NULL REFERENCES oauth_clients(client_id), user_id text NOT NULL,
 expires_at timestamptz NOT NULL,
 FOREIGN KEY (lab_id,user_id) REFERENCES users(lab_id,id) ON DELETE CASCADE
);
