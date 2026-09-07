ALTER TABLE documents ADD COLUMN description text;
ALTER TABLE documents ADD COLUMN uploaded_by uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE documents ADD COLUMN file_name varchar(255);
CREATE INDEX documents_visibility ON documents (access_level, published_at DESC);
