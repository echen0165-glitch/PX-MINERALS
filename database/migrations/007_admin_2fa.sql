CREATE TABLE admin_totp_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  secret text NOT NULL,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  last_used_step bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sessions ADD COLUMN second_factor_verified_at timestamptz;
