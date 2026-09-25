
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  owner_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, owner_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'owner_name', ''), COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  building_type TEXT NOT NULL DEFAULT 'Residential',
  floors INTEGER NOT NULL DEFAULT 1,
  area NUMERIC NOT NULL DEFAULT 0,
  foundation TEXT NOT NULL DEFAULT '',
  roof TEXT NOT NULL DEFAULT '',
  budget NUMERIC NOT NULL DEFAULT 0,
  start_date DATE,
  status TEXT NOT NULL DEFAULT 'Draft',
  estimated_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects" ON public.projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drawings TO authenticated;
GRANT ALL ON public.drawings TO service_role;
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own drawings" ON public.drawings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ai_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  detections JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_results TO authenticated;
GRANT ALL ON public.ai_results TO service_role;
ALTER TABLE public.ai_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai results" ON public.ai_results FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.estimation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  quantities JSONB NOT NULL DEFAULT '{}'::jsonb,
  selections JSONB NOT NULL DEFAULT '{}'::jsonb,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimation_results TO authenticated;
GRANT ALL ON public.estimation_results TO service_role;
ALTER TABLE public.estimation_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own estimations" ON public.estimation_results FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  report_name TEXT NOT NULL DEFAULT 'Estimation Report',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports" ON public.reports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  brand TEXT NOT NULL,
  quality TEXT NOT NULL,
  unit TEXT NOT NULL,
  price NUMERIC NOT NULL
);
GRANT SELECT ON public.materials TO authenticated, anon;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials readable" ON public.materials FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.materials (category, brand, quality, unit, price) VALUES
('Cement','UltraTech','OPC 53 Grade','Bag',450),
('Cement','Ramco','OPC 53 Grade','Bag',430),
('Cement','ACC Gold','PPC Premium','Bag',440),
('Cement','Dalmia','OPC 43 Grade','Bag',410),
('Cement','Shree Cement','PPC Standard','Bag',405),
('Cement','JK Cement','OPC 53 Grade','Bag',435),
('Steel','TATA Steel','Fe 550D','Kg',78),
('Steel','JSW','Fe 500D','Kg',74),
('Steel','SAIL','Fe 500','Kg',72),
('Steel','Kamdhenu','Fe 550','Kg',70),
('Bricks','Red Brick','Standard Clay','Piece',9),
('Bricks','Fly Ash','Class A','Piece',7),
('Bricks','AAC Block','Autoclaved','Piece',55),
('Sand','River Sand','Fine Grade','Cu.ft',62),
('Sand','M Sand','Manufactured','Cu.ft',48),
('Concrete','UltraTech Ready Mix','M25','Cu.m',5600),
('Concrete','ACC Ready Mix','M25','Cu.m',5400),
('Paint','Asian Paints','Royale Premium','Litre',420),
('Paint','Berger','Silk Luxury','Litre',380),
('Paint','Nerolac','Impressions','Litre',360),
('Paint','Indigo','Sheen Emulsion','Litre',330),
('Wire','Polycab','FR 2.5 sq.mm','Metre',32),
('Wire','Finolex','FR-LSH 2.5 sq.mm','Metre',30),
('Wire','Havells','Life Line 2.5 sq.mm','Metre',34),
('PVC Pipe','Astral','CPVC SDR 11','Metre',185),
('PVC Pipe','Supreme','UPVC Schedule 40','Metre',160),
('PVC Pipe','Ashirvad','CPVC Flowguard','Metre',175),
('PVC Pipe','Prince','UPVC Standard','Metre',145);

CREATE POLICY "own drawing files read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'drawings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own drawing files insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'drawings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own drawing files delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'drawings' AND auth.uid()::text = (storage.foldername(name))[1]);
