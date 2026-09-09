-- The welcome bonus belongs to the principal balance. Gift-code bonuses
-- remain in bonus_balance and keep their investment-only restriction.
UPDATE wallets
SET available_balance = available_balance + signup_bonus_balance,
    signup_bonus_balance = 0,
    updated_at = now()
WHERE signup_bonus_balance > 0;
