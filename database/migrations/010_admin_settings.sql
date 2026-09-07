CREATE TABLE system_settings (
  setting_key varchar(100) PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('maintenance', '{"enabled":false,"message":"PX MINERALS est temporairement en maintenance. Veuillez revenir plus tard."}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
