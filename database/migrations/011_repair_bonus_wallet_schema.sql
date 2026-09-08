-- Keep bonus redemption compatible with databases provisioned before the
-- welcome/gift bonus split migration.
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS signup_bonus_balance bigint NOT NULL DEFAULT 0;

ALTER TABLE wallet_ledger_entries
  ADD COLUMN IF NOT EXISTS signup_bonus_delta_xof bigint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'wallets'::regclass AND conname = 'wallets_signup_bonus_balance_check'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_signup_bonus_balance_check CHECK (signup_bonus_balance >= 0);
  END IF;
END $$;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_balance_bucket_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_balance_bucket_check
  CHECK (balance_bucket IN ('available', 'pending', 'bonus', 'signup_bonus', 'referral'));
