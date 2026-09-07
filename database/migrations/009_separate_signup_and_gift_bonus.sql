-- The welcome bonus may be withdrawn under the ordinary withdrawal rules.
-- Gift-code bonuses remain investment-only, so their origin is tracked separately.
ALTER TABLE wallets
  ADD COLUMN signup_bonus_balance bigint NOT NULL DEFAULT 0 CHECK (signup_bonus_balance >= 0);

ALTER TABLE wallet_ledger_entries
  ADD COLUMN signup_bonus_delta_xof bigint NOT NULL DEFAULT 0;

ALTER TABLE transactions DROP CONSTRAINT transactions_balance_bucket_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_balance_bucket_check
  CHECK (balance_bucket IN ('available', 'pending', 'bonus', 'signup_bonus', 'referral'));

-- For pre-existing accounts, reserve every redeemed gift-code amount as non-withdrawable.
-- This conservative conversion never makes a gift-code balance withdrawable.
WITH redeemed_gifts AS (
  SELECT br.user_id, coalesce(sum(c.amount_xof), 0)::bigint AS total_xof
  FROM bonus_redemptions br
  JOIN bonus_campaigns c ON c.id = br.bonus_id
  GROUP BY br.user_id
)
UPDATE wallets w
SET signup_bonus_balance = greatest(0, w.bonus_balance - coalesce(g.total_xof, 0)),
    updated_at = now()
FROM redeemed_gifts g
WHERE w.user_id = g.user_id;

UPDATE wallets
SET signup_bonus_balance = bonus_balance,
    updated_at = now()
WHERE user_id NOT IN (SELECT user_id FROM bonus_redemptions);
