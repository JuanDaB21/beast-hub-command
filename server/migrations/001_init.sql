-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE order_source AS ENUM ('shopify', 'manual');
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE work_order_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE alert_issue_type AS ENUM ('low_stock', 'price_change', 'quality', 'delay', 'other');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high');

-- =========================================================
-- TRIGGER FN: updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- USERS (auth) + PROFILES (staff)
-- Replaces Supabase auth.users + profiles
-- =========================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile when a user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.name, NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_create_profile
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =========================================================
-- CATÁLOGOS
-- =========================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);

CREATE TABLE colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  hex_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeds
INSERT INTO categories (name) VALUES
  ('Telas'), ('Avíos'), ('Empaque');

INSERT INTO subcategories (category_id, name)
SELECT c.id, s.name FROM categories c
JOIN (VALUES
  ('Telas','Algodón'),
  ('Telas','Poliéster'),
  ('Telas','Mezcla'),
  ('Avíos','Hilos'),
  ('Avíos','Botones'),
  ('Avíos','Cierres'),
  ('Empaque','Bolsas'),
  ('Empaque','Etiquetas')
) AS s(category, name) ON s.category = c.name;

INSERT INTO colors (name, hex_code) VALUES
  ('Negro','#000000'),
  ('Blanco','#FFFFFF'),
  ('Rojo','#DC2626'),
  ('Azul','#2563EB'),
  ('Verde','#16A34A'),
  ('Gris','#6B7280');

INSERT INTO sizes (label, sort_order) VALUES
  ('XS',1),('S',2),('M',3),('L',4),('XL',5),('XXL',6);
