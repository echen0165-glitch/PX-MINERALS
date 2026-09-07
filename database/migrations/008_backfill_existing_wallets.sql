DO $$
DECLARE
  account record;
  movement_id uuid;
BEGIN
  FOR account IN
    SELECT u.id
    FROM users u
    LEFT JOIN signup_bonus_grants bonus_grant ON bonus_grant.user_id = u.id
    WHERE u.role = 'client' AND bonus_grant.user_id IS NULL
  LOOP
    INSERT INTO wallets (user_id) VALUES (account.id) ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO transactions (user_id, type, amount_xof, balance_bucket, status, reference, idempotency_key, metadata)
    VALUES (account.id, 'bonus', 1500, 'bonus', 'completed', 'SIGNUP-BONUS-' || account.id, gen_random_uuid(), '{"kind":"signup_bonus_backfill"}'::jsonb)
    RETURNING id INTO movement_id;
    UPDATE wallets SET bonus_balance = bonus_balance + 1500, version = version + 1, updated_at = now() WHERE user_id = account.id;
    INSERT INTO wallet_ledger_entries (wallet_user_id, transaction_id, bonus_delta_xof, reason)
    VALUES (account.id, movement_id, 1500, 'Bonus de bienvenue à l’inscription');
    INSERT INTO signup_bonus_grants (user_id, amount_xof, transaction_id) VALUES (account.id, 1500, movement_id);
  END LOOP;
END $$;
