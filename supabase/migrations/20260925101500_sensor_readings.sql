-- Create sensor_readings table for IoT ESP32 Cement Monitor
CREATE TABLE IF NOT EXISTS public.sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects ON DELETE CASCADE,
  temperature NUMERIC NOT NULL DEFAULT 0,
  humidity NUMERIC NOT NULL DEFAULT 0,
  moisture NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'NORMAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant privileges for ESP32 REST API access (anon key / authenticated)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensor_readings TO anon, authenticated;
GRANT ALL ON public.sensor_readings TO service_role;

-- Enable Row-Level Security
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

-- Allow reading and inserting sensor readings from ESP32 / anon key / authenticated users
CREATE POLICY "Allow public select on sensor_readings" ON public.sensor_readings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert on sensor_readings" ON public.sensor_readings FOR INSERT TO anon, authenticated WITH CHECK (true);
