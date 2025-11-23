-- =========================================
-- 0) Extensions and Types (idempotent)
-- =========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END$$;

-- =========================================
-- 1) Roles mapping table (optional, used by RLS)
-- =========================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- =========================================
-- 2) has_role helper (safe re-create)
-- =========================================
-- Note: has_role function is assumed to already exist in the database
-- If it doesn't exist, you can create it manually in the SQL editor:
/*
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role   = _role
  );
$$;
*/

-- =========================================
-- 3) Core entities (Option B)
-- =========================================

-- 3.1 Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id                   text UNIQUE NOT NULL,              -- from merged A..D & TE..TP
  name                          text NOT NULL,
  issuer                        text,
  email                         text,
  prefecture                    text,
  age                           integer,
  nailist_experience            text,
  occupation_type               text,
  current_monthly_customers     integer,
  salon_work_experience         text,
  salon_monthly_customers       integer,
  blank_period                  text,
  status                        text DEFAULT 'new' CHECK (status IN ('new','in_progress','completed')),
  application_date              date,
  created_at                    timestamptz DEFAULT now(),
  updated_at                    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_external_id ON public.customers(external_id);
CREATE INDEX IF NOT EXISTS idx_customers_status      ON public.customers(status);

-- 3.2 Assessments (one row per current/previous import you keep)
CREATE TABLE IF NOT EXISTS public.assessments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id          uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  assessment_date      date NOT NULL,        -- 採点日
  is_current           boolean DEFAULT true, -- current vs previous

  -- category scores/ratings (fast query)
  care_score           integer,
  care_rating          text,
  one_color_score      integer,
  one_color_rating     text,
  time_score           integer,
  time_rating          text,

  -- totals
  total_score          integer,
  total_rating         text,
  total_time_minutes   integer,
  total_time_seconds   integer,

  -- optional structured details (small)
  care_details         jsonb,
  one_color_details    jsonb,
  time_details         jsonb,

  -- import meta
  source               text DEFAULT 'csv_import',
  header_depth         integer,              -- detected header rows (1..14)
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessments_customer   ON public.assessments(customer_id);
CREATE INDEX IF NOT EXISTS idx_assessments_date       ON public.assessments(assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_is_current ON public.assessments(is_current);

-- 3.3 Leaf Sub-scores (chart/aggregate)
CREATE TABLE IF NOT EXISTS public.scores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  category       text NOT NULL,      -- 'care' | 'one_color' | 'time'
  sub_key        text NOT NULL,      -- lowest header name / stable key
  score          integer,
  rating         text,
  comment        text,
  ord            smallint,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_assessment ON public.scores(assessment_id);
CREATE INDEX IF NOT EXISTS idx_scores_cat_key    ON public.scores(category, sub_key);

-- 3.4 Flexible JSONB blocks (everything else from ranges & span groups)
CREATE TABLE IF NOT EXISTS public.section_blobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  assessment_id  uuid REFERENCES public.assessments(id) ON DELETE CASCADE, -- nullable for pure customer-level blobs
  section        text NOT NULL,   -- e.g. 'score','radar_chart','care_score','one_color_radar_chart', ...
  subtype        text NOT NULL,   -- e.g. 'current','previous','final','average','basic','demographics','raw','merged'
  data           jsonb NOT NULL,
  source         text DEFAULT 'csv_import',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(customer_id, assessment_id, section, subtype)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_section_blobs_keys ON public.section_blobs(section, subtype);
CREATE INDEX IF NOT EXISTS idx_section_blobs_cs   ON public.section_blobs(customer_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_section_blobs_gin  ON public.section_blobs USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_section_blobs_section ON public.section_blobs(section);
CREATE INDEX IF NOT EXISTS idx_section_blobs_customer_section ON public.section_blobs(customer_id, section);

-- Add comments for better documentation
COMMENT ON TABLE public.section_blobs IS 'Stores structured data from CSV imports organized by section and subtype';
COMMENT ON COLUMN public.section_blobs.section IS 'Section name (e.g., score, care_score, one_color_score, time_score, radar_chart, etc.)';
COMMENT ON COLUMN public.section_blobs.subtype IS 'Data subtype (e.g., current, previous, final, average, basic, demographics, etc.)';
COMMENT ON COLUMN public.section_blobs.data IS 'JSONB containing the actual data for this section/subtype combination';

-- 3.5 Import audit (debug/repro)
CREATE TABLE IF NOT EXISTS public.import_audits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  assessment_id  uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  file_name      text,
  header_depth   integer,
  header_layers  jsonb,  -- 1..N header rows (arrays)
  final_header   jsonb,  -- concatenated header array
  group_row      jsonb,  -- row used to detect spans
  spans          jsonb,  -- [{key,start,end},...]
  raw_data_row   jsonb,  -- first data row array
  created_at     timestamptz DEFAULT now()
);

-- =========================================
-- 4) Triggers (updated_at)
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Create triggers with error handling to avoid conflicts
DO $$
BEGIN
  -- Create customers trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_customers_updated_at'
  ) THEN
    CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  -- Create assessments trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_assessments_updated_at'
  ) THEN
    CREATE TRIGGER update_assessments_updated_at
    BEFORE UPDATE ON public.assessments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  -- Create section_blobs trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_section_blobs_updated_at'
  ) THEN
    CREATE TRIGGER update_section_blobs_updated_at
    BEFORE UPDATE ON public.section_blobs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error with trigger creation, continue
    NULL;
END$$;

-- =========================================
-- 4.1) Helper functions for data retrieval
-- =========================================

-- Function to get customer's latest assessment data
CREATE OR REPLACE FUNCTION public.get_customer_latest_assessment_data(p_customer_id uuid)
RETURNS TABLE (
  section text,
  subtype text,
  data jsonb,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sb.section,
    sb.subtype,
    sb.data,
    sb.created_at
  FROM public.section_blobs sb
  JOIN public.assessments a ON sb.assessment_id = a.id
  WHERE sb.customer_id = p_customer_id
    AND a.is_current = true
  ORDER BY sb.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get customer's comparison data (average vs current)
CREATE OR REPLACE FUNCTION public.get_customer_comparison_data(p_customer_id uuid)
RETURNS TABLE (
  section text,
  current_data jsonb,
  average_data jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH current_data AS (
    SELECT section, data
    FROM public.section_blobs
    WHERE customer_id = p_customer_id
      AND section IN ('score', 'care_score', 'one_color_score', 'time_score')
      AND subtype = 'current'
  ),
  average_data AS (
    SELECT section, data
    FROM public.section_blobs
    WHERE customer_id = p_customer_id
      AND section IN ('score', 'care_score', 'one_color_score', 'time_score')
      AND subtype = 'average'
  )
  SELECT
    c.section,
    c.data as current_data,
    a.data as average_data
  FROM current_data c
  LEFT JOIN average_data a ON c.section = a.section;
END;
$$ LANGUAGE plpgsql;

-- Function to get radar chart data for a customer
CREATE OR REPLACE FUNCTION public.get_customer_radar_data(p_customer_id uuid)
RETURNS TABLE (
  name text,
  current_score integer,
  average_score integer
) AS $$
BEGIN
  RETURN QUERY
  WITH radar_current AS (
    SELECT data
    FROM public.section_blobs
    WHERE customer_id = p_customer_id
      AND section = 'radar_chart'
      AND subtype = 'current'
  ),
  radar_average AS (
    SELECT data
    FROM public.section_blobs
    WHERE customer_id = p_customer_id
      AND section = 'radar_chart'
      AND subtype = 'average'
  )
  SELECT
    '総合' as name,
    COALESCE(
      (SELECT jsonb_extract_path_text(current.data, '総合 スコア')::integer
       FROM radar_current current),
      0
    ) as current_score,
    COALESCE(
      (SELECT jsonb_extract_path_text(average.data, '総合 スコア')::integer
       FROM radar_average average),
      0
    ) as average_score
  
  UNION ALL
  
  SELECT
    'ケア' as name,
    COALESCE(
      (SELECT jsonb_extract_path_text(current.data, 'ケア スコア')::integer
       FROM radar_current current),
      0
    ) as current_score,
    COALESCE(
      (SELECT jsonb_extract_path_text(average.data, 'ケア スコア')::integer
       FROM radar_average average),
      0
    ) as average_score
  
  UNION ALL
  
  SELECT
    'ワンカラー' as name,
    COALESCE(
      (SELECT jsonb_extract_path_text(current.data, 'ワンカラー スコア')::integer
       FROM radar_current current),
      0
    ) as current_score,
    COALESCE(
      (SELECT jsonb_extract_path_text(average.data, 'ワンカラー スコア')::integer
       FROM radar_average average),
      0
    ) as average_score
  
  UNION ALL
  
  SELECT
    'タイム' as name,
    COALESCE(
      (SELECT jsonb_extract_path_text(current.data, 'タイム スコア')::integer
       FROM radar_current current),
      0
    ) as current_score,
    COALESCE(
      (SELECT jsonb_extract_path_text(average.data, 'タイム スコア')::integer
       FROM radar_average average),
      0
    ) as average_score;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 5) Helpful view
-- =========================================
CREATE OR REPLACE VIEW public.v_latest_assessments AS
SELECT DISTINCT ON (a.customer_id)
  a.*
FROM public.assessments a
ORDER BY a.customer_id, a.assessment_date DESC, a.created_at DESC;

-- Create view for customer summary data
CREATE OR REPLACE VIEW public.v_customer_summary AS
SELECT
  c.id,
  c.external_id,
  c.name,
  c.issuer,
  c.email,
  c.prefecture,
  c.application_date,
  a.assessment_date,
  a.total_score,
  a.total_rating,
  a.care_score,
  a.care_rating,
  a.one_color_score,
  a.one_color_rating,
  a.time_score,
  a.time_rating,
  a.created_at as assessment_created_at
FROM public.customers c
JOIN public.assessments a ON c.id = a.customer_id
WHERE a.is_current = true;

-- =========================================
-- 6) Row Level Security (simple & safe)
--    - All authenticated users can SELECT
--    - Only admins can INSERT/UPDATE/DELETE
-- =========================================
ALTER TABLE public.user_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_blobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_audits   ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if rerun with error handling
DO $$
BEGIN
  -- customers
  DROP POLICY IF EXISTS customers_select ON public.customers;
  DROP POLICY IF EXISTS customers_write_admin ON public.customers;

  -- assessments
  DROP POLICY IF EXISTS assessments_select ON public.assessments;
  DROP POLICY IF EXISTS assessments_write_admin ON public.assessments;

  -- scores
  DROP POLICY IF EXISTS scores_select ON public.scores;
  DROP POLICY IF EXISTS scores_write_admin ON public.scores;

  -- section_blobs
  DROP POLICY IF EXISTS section_blobs_select ON public.section_blobs;
  DROP POLICY IF EXISTS section_blobs_write_admin ON public.section_blobs;

  -- import_audits
  DROP POLICY IF EXISTS import_audits_select ON public.import_audits;
  DROP POLICY IF EXISTS import_audits_write_admin ON public.import_audits;

  -- user_roles
  DROP POLICY IF EXISTS user_roles_self_select ON public.user_roles;
  DROP POLICY IF EXISTS user_roles_admin_write ON public.user_roles;
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error with policy dropping, continue
    NULL;
END$$;

-- customers
CREATE POLICY customers_select
ON public.customers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY customers_write_admin
ON public.customers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- assessments
CREATE POLICY assessments_select
ON public.assessments
FOR SELECT
TO authenticated
USING (true);
CREATE POLICY assessments_write_admin
ON public.assessments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- scores
CREATE POLICY scores_select
ON public.scores
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY scores_write_admin
ON public.scores
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- section_blobs
CREATE POLICY section_blobs_select
ON public.section_blobs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY section_blobs_write_admin
ON public.section_blobs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- import_audits
CREATE POLICY import_audits_select
ON public.import_audits
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY import_audits_write_admin
ON public.import_audits
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- user_roles: users can read their own; only admins can manage
CREATE POLICY user_roles_self_select
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY user_roles_admin_write
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
