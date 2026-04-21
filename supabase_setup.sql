-- ============================================================
--  RoboAI Studio — Supabase Database Setup
--  Uruchom jako SQL w Supabase SQL Editor
--  Panel: https://supabase.com/dashboard
-- ============================================================

-- 1. ROZSZERZENIA
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABELE
-- ============================================================

-- Profile użytkowników
CREATE TABLE IF NOT EXISTS public.profiles (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    credits       INTEGER NOT NULL DEFAULT 10,
    usage_count   INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sesje użytkowników
CREATE TABLE IF NOT EXISTS public.sessions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token TEXT NOT NULL UNIQUE,
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- Connect Codes (do pluginu Roblox)
CREATE TABLE IF NOT EXISTS public.connect_codes (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code         TEXT NOT NULL UNIQUE,
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- Historia zapytań AI
CREATE TABLE IF NOT EXISTS public.ai_history (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_msg   TEXT NOT NULL,
    ai_msg     TEXT,
    mode       TEXT NOT NULL DEFAULT 'quick' CHECK (mode IN ('quick', 'plan')),
    model      TEXT,
    cost       INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kolejka zadań do pluginu
CREATE TABLE IF NOT EXISTS public.plugin_tasks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_id     TEXT NOT NULL,
    code        TEXT,
    script_name TEXT NOT NULL DEFAULT 'Script',
    script_type TEXT NOT NULL DEFAULT 'LocalScript',
    parent      TEXT NOT NULL DEFAULT 'StarterGui',
    action      TEXT NOT NULL DEFAULT 'create',
    task_order  INTEGER NOT NULL DEFAULT 1,
    total       INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ustawienia globalne (klucz API itp.)
CREATE TABLE IF NOT EXISTS public.settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. INDEKSY
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_token   ON public.sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_connect_code     ON public.connect_codes(code);
CREATE INDEX IF NOT EXISTS idx_connect_user     ON public.connect_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user     ON public.ai_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plugin_tasks_user ON public.plugin_tasks(user_id, created_at);

-- ============================================================
-- 4. FUNKCJE (RPC)
-- ============================================================

-- Sprawdź sesję i zwróć usera
CREATE OR REPLACE FUNCTION public.get_user_by_session(p_token TEXT)
RETURNS TABLE(
    user_id      UUID,
    username     TEXT,
    email        TEXT,
    role         TEXT,
    credits      INTEGER,
    usage_count  INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.username, p.email, p.role, p.credits, p.usage_count
    FROM public.sessions s
    JOIN public.profiles p ON p.id = s.user_id
    WHERE s.session_token = p_token
      AND s.expires_at > NOW();
END;
$$;

-- Odejmij kredyty i zwiększ usage (atomowo)
CREATE OR REPLACE FUNCTION public.deduct_credits(p_user_id UUID, p_amount INTEGER)
RETURNS TABLE(ok BOOLEAN, remaining INTEGER) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_credits INTEGER;
BEGIN
    SELECT credits INTO v_credits FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF v_credits IS NULL OR v_credits < p_amount THEN
        RETURN QUERY SELECT FALSE, COALESCE(v_credits, 0);
        RETURN;
    END IF;
    UPDATE public.profiles
        SET credits     = credits - p_amount,
            usage_count = usage_count + 1,
            updated_at  = NOW()
        WHERE id = p_user_id;
    RETURN QUERY SELECT TRUE, v_credits - p_amount;
END;
$$;

-- Dodaj kredyty adminowi
CREATE OR REPLACE FUNCTION public.add_credits(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_credits INTEGER;
BEGIN
    UPDATE public.profiles
        SET credits = credits + p_amount, updated_at = NOW()
        WHERE id = p_user_id
        RETURNING credits INTO v_credits;
    RETURN v_credits;
END;
$$;

-- Pobierz zadania dla pluginu (i usuń je z kolejki)
CREATE OR REPLACE FUNCTION public.dequeue_tasks(p_connect_code TEXT)
RETURNS TABLE(
    task_id     TEXT,
    code        TEXT,
    script_name TEXT,
    script_type TEXT,
    parent      TEXT,
    action      TEXT,
    task_order  INTEGER,
    total       INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Znajdź usera po connect code
    SELECT user_id INTO v_user_id
    FROM public.connect_codes
    WHERE code = p_connect_code AND expires_at > NOW()
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_CODE';
    END IF;

    -- Zwróć zadania
    RETURN QUERY
    SELECT pt.task_id, pt.code, pt.script_name, pt.script_type,
           pt.parent, pt.action, pt.task_order, pt.total
    FROM public.plugin_tasks pt
    WHERE pt.user_id = v_user_id
    ORDER BY pt.created_at ASC;

    -- Usuń zwrócone zadania
    DELETE FROM public.plugin_tasks WHERE user_id = v_user_id;
END;
$$;

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plugin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings    ENABLE ROW LEVEL SECURITY;

-- Profiles: każdy widzi tylko swój profil
CREATE POLICY "profiles_own" ON public.profiles
    FOR ALL USING (TRUE);   -- service_role omija RLS automatycznie

-- Settings: tylko service_role
CREATE POLICY "settings_service" ON public.settings
    FOR ALL USING (TRUE);

-- Reszta: wszystko przez service_role (backend)
CREATE POLICY "sessions_all"      ON public.sessions      FOR ALL USING (TRUE);
CREATE POLICY "connect_codes_all" ON public.connect_codes FOR ALL USING (TRUE);
CREATE POLICY "history_all"       ON public.ai_history    FOR ALL USING (TRUE);
CREATE POLICY "tasks_all"         ON public.plugin_tasks  FOR ALL USING (TRUE);

-- ============================================================
-- 6. TRIGGER — auto update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_settings_updated
    BEFORE UPDATE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. DANE STARTOWE
-- ============================================================
INSERT INTO public.settings (key, value) VALUES
    ('groq_api_key', ''),
    ('admin_password', 'changeme123')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- GOTOWE!
-- Ustaw zmienne środowiskowe w projekcie (Netlify / Vercel):
--   SUPABASE_URL          = https://xxxx.supabase.co
--   SUPABASE_SERVICE_KEY  = eyJhbG...  (Settings > API > service_role)
-- ============================================================
