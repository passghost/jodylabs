-- SQL for Supabase table (pirates)
CREATE TABLE pirates (
  id uuid PRIMARY KEY,
  email text,
  x int,
  y int,
  hull int,
  crew int,
  items jsonb,
  booty int,
  color text
);
CREATE UNIQUE INDEX ON pirates(email);
