CREATE TABLE signup_bonus_grants (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  amount_xof bigint NOT NULL CHECK (amount_xof = 1500),
  transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now()
);
