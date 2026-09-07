CREATE TABLE wallet_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_user_id uuid NOT NULL REFERENCES wallets(user_id) ON DELETE RESTRICT,
  transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  available_delta_xof bigint NOT NULL DEFAULT 0,
  pending_delta_xof bigint NOT NULL DEFAULT 0,
  bonus_delta_xof bigint NOT NULL DEFAULT 0,
  referral_delta_xof bigint NOT NULL DEFAULT 0,
  reason varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (available_delta_xof <> 0 OR pending_delta_xof <> 0 OR bonus_delta_xof <> 0 OR referral_delta_xof <> 0)
);
CREATE INDEX wallet_ledger_by_user ON wallet_ledger_entries (wallet_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_wallet_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'wallet ledger entries are immutable';
END;
$$;

CREATE TRIGGER wallet_ledger_immutable
BEFORE UPDATE OR DELETE ON wallet_ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_wallet_ledger_mutation();
