-- Restore the daily gain schedule for investments created before the
-- per-investment event schedule was introduced.  The unique constraint on
-- (investment_id, scheduled_at) makes this migration safe to re-run.
WITH legacy AS (
  SELECT
    i.id,
    i.purchased_at,
    i.duration_days,
    i.daily_gain_xof,
    LEAST(
      i.duration_days,
      FLOOR(GREATEST(i.gains_received_xof, 0)::numeric /
        NULLIF(i.daily_gain_xof, 0))::int
    ) AS already_credited
  FROM investments i
  WHERE i.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM investment_gain_events ge
      WHERE ge.investment_id = i.id
    )
)
INSERT INTO investment_gain_events (investment_id, scheduled_at, amount_xof, status, credited_at)
SELECT
  legacy.id,
  legacy.purchased_at + (series.day_number * interval '1 day'),
  legacy.daily_gain_xof,
  CASE WHEN series.day_number <= legacy.already_credited THEN 'completed'::operation_status ELSE 'pending'::operation_status END,
  CASE WHEN series.day_number <= legacy.already_credited THEN legacy.purchased_at + (series.day_number * interval '1 day') ELSE NULL END
FROM legacy
CROSS JOIN LATERAL generate_series(1, legacy.duration_days) AS series(day_number)
ON CONFLICT (investment_id, scheduled_at) DO NOTHING;

-- Keep the denormalized next-gain pointer consistent for backfilled rows.
UPDATE investments i
SET status = 'completed', next_gain_at = i.ends_at
WHERE i.status = 'active'
  AND EXISTS (SELECT 1 FROM investment_gain_events ge WHERE ge.investment_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM investment_gain_events ge WHERE ge.investment_id = i.id AND ge.status = 'pending');

UPDATE investments i
SET next_gain_at = (
  SELECT MIN(ge.scheduled_at)
  FROM investment_gain_events ge
  WHERE ge.investment_id = i.id AND ge.status = 'pending'
)
WHERE i.status = 'active'
  AND EXISTS (SELECT 1 FROM investment_gain_events ge WHERE ge.investment_id = i.id AND ge.status = 'pending');
