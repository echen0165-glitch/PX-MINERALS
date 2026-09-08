-- Some accounts received their signup grant before the wallet row was
-- persisted. Ensure every client can receive deposits and bonuses.
INSERT INTO wallets (user_id)
SELECT u.id
FROM users u
LEFT JOIN wallets w ON w.user_id = u.id
WHERE u.role = 'client' AND w.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

UPDATE wallets w
SET bonus_balance = coalesce(g.amount_xof, 0),
    signup_bonus_balance = coalesce(g.amount_xof, 0),
    updated_at = now()
FROM (
  SELECT user_id, sum(amount_xof)::bigint AS amount_xof
  FROM signup_bonus_grants
  GROUP BY user_id
) g
WHERE w.user_id = g.user_id
  AND w.bonus_balance = 0
  AND w.signup_bonus_balance = 0;
