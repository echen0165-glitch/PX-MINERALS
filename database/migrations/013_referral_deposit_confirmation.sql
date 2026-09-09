-- Un parrainage devient confirmé uniquement quand le filleul réalise son premier dépôt validé.
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Conserve correctement l’état des parrainages et commissions déjà validés.
UPDATE referrals r
SET confirmed_at = commission.first_confirmed_at
FROM (
  SELECT referral_id, min(created_at) AS first_confirmed_at
  FROM referral_commissions
  GROUP BY referral_id
) commission
WHERE commission.referral_id = r.id
  AND r.confirmed_at IS NULL;

CREATE INDEX IF NOT EXISTS referrals_confirmation_by_referred
  ON referrals (referred_user_id, confirmed_at);
