ALTER TABLE deposits ADD COLUMN proof_storage_key varchar(500);
ALTER TABLE wave_transactions ADD COLUMN client_reference varchar(128) UNIQUE;
ALTER TABLE wave_transactions ADD COLUMN payment_url text;
