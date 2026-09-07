CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('client', 'admin');
CREATE TYPE account_status AS ENUM ('pending_email', 'active', 'suspended', 'blocked');
CREATE TYPE operation_status AS ENUM ('pending', 'approved', 'refused', 'processing', 'completed', 'failed', 'refunded', 'cancelled');
CREATE TYPE investment_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE offer_term AS ENUM ('short', 'long');
CREATE TYPE ledger_type AS ENUM ('deposit', 'investment', 'gain', 'referral_commission', 'bonus', 'withdrawal', 'refund', 'correction');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL DEFAULT 'client',
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  username varchar(32) NOT NULL UNIQUE CHECK (username ~ '^[A-Za-z0-9_-]{3,32}$'),
  email varchar(320) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  birth_date date NOT NULL,
  wave_number varchar(32) NOT NULL,
  avatar_key varchar(255),
  client_code varchar(32) NOT NULL UNIQUE,
  status account_status NOT NULL DEFAULT 'pending_email',
  email_verified_at timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallets (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  available_balance bigint NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance bigint NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  bonus_balance bigint NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0),
  referral_balance bigint NOT NULL DEFAULT 0 CHECK (referral_balance >= 0),
  total_gains_received bigint NOT NULL DEFAULT 0 CHECK (total_gains_received >= 0),
  funds_frozen boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mineral_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mineral_name varchar(64) NOT NULL,
  term offer_term NOT NULL,
  price_xof bigint NOT NULL CHECK (price_xof > 0),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  daily_gain_xof bigint NOT NULL CHECK (daily_gain_xof > 0),
  is_locked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mineral_name, term)
);

CREATE TABLE investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  offer_id uuid NOT NULL REFERENCES mineral_offers(id) ON DELETE RESTRICT,
  price_xof bigint NOT NULL CHECK (price_xof > 0),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  daily_gain_xof bigint NOT NULL CHECK (daily_gain_xof > 0),
  status investment_status NOT NULL DEFAULT 'active',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  next_gain_at timestamptz NOT NULL,
  gains_received_xof bigint NOT NULL DEFAULT 0 CHECK (gains_received_xof >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX investments_by_user_status ON investments (user_id, status, purchased_at DESC);

CREATE TABLE investment_gain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid NOT NULL REFERENCES investments(id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL,
  credited_at timestamptz,
  amount_xof bigint NOT NULL CHECK (amount_xof > 0),
  status operation_status NOT NULL DEFAULT 'pending',
  UNIQUE (investment_id, scheduled_at)
);

CREATE TABLE deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_xof bigint NOT NULL CHECK (amount_xof IN (3755,7050,20050,30050,50000,85000,150000,275000,475000,755000,1250000,1749500)),
  status operation_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  refusal_reason text,
  idempotency_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deposits_by_status ON deposits (status, requested_at);

CREATE TABLE withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  gross_amount_xof bigint NOT NULL CHECK (gross_amount_xof > 0),
  commission_rate_basis_points integer NOT NULL CHECK (commission_rate_basis_points IN (2500, 3500)),
  commission_xof bigint NOT NULL CHECK (commission_xof >= 0),
  net_amount_xof bigint NOT NULL CHECK (net_amount_xof > 0),
  wave_number varchar(32) NOT NULL,
  status operation_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  refusal_reason text,
  idempotency_key uuid NOT NULL UNIQUE,
  CHECK (gross_amount_xof = commission_xof + net_amount_xof)
);
CREATE INDEX withdrawals_daily_limit ON withdrawals (user_id, requested_at);
CREATE INDEX withdrawals_by_status ON withdrawals (status, requested_at);

CREATE TABLE wave_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid UNIQUE REFERENCES deposits(id) ON DELETE RESTRICT,
  withdrawal_id uuid UNIQUE REFERENCES withdrawals(id) ON DELETE RESTRICT,
  direction varchar(16) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  wave_reference varchar(255) UNIQUE,
  wave_status varchar(64),
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((deposit_id IS NOT NULL)::integer + (withdrawal_id IS NOT NULL)::integer = 1)
);

CREATE TABLE wave_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_event_id varchar(255) NOT NULL UNIQUE,
  event_type varchar(128) NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type ledger_type NOT NULL,
  amount_xof bigint NOT NULL CHECK (amount_xof <> 0),
  balance_bucket varchar(16) NOT NULL CHECK (balance_bucket IN ('available', 'pending', 'bonus', 'referral')),
  status operation_status NOT NULL DEFAULT 'completed',
  reference varchar(255) UNIQUE,
  idempotency_key uuid NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_by_user ON transactions (user_id, created_at DESC);

CREATE TABLE referral_codes (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  code varchar(32) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, referred_user_id, level)
);
CREATE TABLE referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE RESTRICT,
  qualifying_deposit_id uuid NOT NULL UNIQUE REFERENCES deposits(id) ON DELETE RESTRICT,
  amount_xof bigint NOT NULL CHECK (amount_xof > 0),
  rate_basis_points integer NOT NULL CHECK (rate_basis_points IN (3000, 500, 400)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bonus_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL UNIQUE,
  amount_xof bigint NOT NULL CHECK (amount_xof > 0),
  max_uses integer NOT NULL CHECK (max_uses > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at timestamptz,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bonus_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bonus_id uuid NOT NULL REFERENCES bonus_campaigns(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bonus_id, user_id)
);

CREATE TABLE email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip_address inet,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title varchar(200) NOT NULL,
  message text NOT NULL,
  link varchar(500),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number varchar(32) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject varchar(200) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(200) NOT NULL,
  storage_key varchar(500) NOT NULL UNIQUE,
  access_level varchar(16) NOT NULL CHECK (access_level IN ('public', 'client', 'private')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE wave_number_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_number varchar(32) NOT NULL,
  requested_number varchar(32) NOT NULL,
  status operation_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  event_type varchar(100) NOT NULL,
  result varchar(32) NOT NULL,
  ip_address inet,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  action_type varchar(100) NOT NULL,
  justification text,
  operation_reference varchar(255),
  result varchar(32) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO mineral_offers (mineral_name, term, price_xof, duration_days, daily_gain_xof) VALUES
  ('Fer', 'short', 3755, 60, 1000), ('Aluminium', 'short', 7050, 60, 2500), ('Zinc', 'short', 20050, 60, 5000), ('Cuivre', 'short', 30050, 60, 8000),
  ('Manganèse', 'short', 50000, 45, 13000), ('Nickel', 'short', 85000, 45, 20000), ('Cobalt', 'short', 150000, 45, 32000), ('Lithium', 'short', 275000, 45, 50000),
  ('Argent', 'short', 475000, 30, 75000), ('Or', 'short', 755000, 30, 110000), ('Platine', 'short', 1250000, 30, 160000), ('Diamant', 'short', 1749500, 30, 220000),
  ('Fer', 'long', 3755, 180, 250), ('Aluminium', 'long', 7050, 180, 500), ('Zinc', 'long', 20050, 180, 1000), ('Cuivre', 'long', 30050, 180, 1500),
  ('Manganèse', 'long', 50000, 270, 2000), ('Nickel', 'long', 85000, 270, 3000), ('Cobalt', 'long', 150000, 270, 5000), ('Lithium', 'long', 275000, 270, 8000),
  ('Argent', 'long', 475000, 365, 6000), ('Or', 'long', 755000, 365, 9000), ('Platine', 'long', 1250000, 365, 13000), ('Diamant', 'long', 1749500, 365, 18000);
