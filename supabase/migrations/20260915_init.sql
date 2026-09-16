-- ====================================================================
-- Derive V1 PostgreSQL Database Schema & Row-Level Security (RLS)
-- Target: 10 Founding Beta Customers ($129/mo)
-- ====================================================================

-- 1. Profiles & Memberships
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tier TEXT DEFAULT 'founding_beta_129',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Skin Profiles (Longitudinal memory of the customer)
CREATE TABLE IF NOT EXISTS public.skin_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    primary_goal TEXT NOT NULL,
    secondary_goals TEXT[] DEFAULT '{}',
    routine_complexity TEXT NOT NULL CHECK (routine_complexity IN ('simple', 'balanced', 'maximize')),
    cost_preference TEXT NOT NULL CHECK (cost_preference IN ('value', 'balanced', 'premium')),
    midday_feel TEXT NOT NULL,
    post_cleanse_tightness BOOLEAN DEFAULT FALSE,
    known_sensitivities TEXT[] DEFAULT '{}',
    active_prescriptions TEXT[] DEFAULT '{}',
    is_pregnant_or_nursing BOOLEAN DEFAULT FALSE,
    additional_notes TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Products & User Shelf
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    key_actives TEXT[] DEFAULT '{}',
    full_ingredients TEXT[] DEFAULT '{}',
    retail_price_approx NUMERIC(10, 2),
    is_catalog_standard BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    detected_brand TEXT,
    detected_name TEXT,
    action TEXT NOT NULL CHECK (action IN ('KEEP', 'STOP', 'REPLACE', 'ADD')),
    action_reason TEXT,
    frequency_nights_per_week INT,
    is_confirmed_by_user BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Routines & Steps (Versioned, never destructively overwritten)
CREATE TABLE IF NOT EXISTS public.routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_review', 'approved', 'published')),
    summary_sentence TEXT NOT NULL,
    founder_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.routine_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    timing TEXT NOT NULL CHECK (timing IN ('am', 'pm')),
    product_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    amount TEXT NOT NULL,
    area TEXT NOT NULL,
    days TEXT[] DEFAULT '{}', -- e.g. {'mon', 'wed', 'fri'}
    purpose TEXT NOT NULL,
    why_chosen TEXT NOT NULL,
    watch_for TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Private Photos
CREATE TABLE IF NOT EXISTS public.user_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    photo_type TEXT NOT NULL CHECK (photo_type IN ('front', 'left', 'right', 'shelf', 'checkin')),
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Check-ins & Refill Requests
CREATE TABLE IF NOT EXISTS public.check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skin_state TEXT NOT NULL CHECK (skin_state IN ('better', 'same', 'worse')),
    irritation TEXT NOT NULL CHECK (irritation IN ('none', 'little', 'lot')),
    notes TEXT,
    ai_analysis_sentence TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refill_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'ordered', 'shipped', 'delivered')),
    tracking_number TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    shipped_at TIMESTAMPTZ
);

-- 7. Founder Ops Tasks & Safety Flags
CREATE TABLE IF NOT EXISTS public.founder_review_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL CHECK (task_type IN ('initial_routine', 'routine_adjustment', 'refill', 'safety_flag')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refill_requests ENABLE ROW LEVEL SECURITY;

-- User Policies: Users can only read/write their own records
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can read own skin profile" ON public.skin_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own skin profile" ON public.skin_profiles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read own user products" ON public.user_products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own user products" ON public.user_products FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read own routines" ON public.routines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read own routine items" ON public.routine_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.routines WHERE routines.id = routine_items.routine_id AND routines.user_id = auth.uid())
);

CREATE POLICY "Users can manage own check-ins" ON public.check_ins FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own refills" ON public.refill_requests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own photos" ON public.user_photos FOR ALL USING (auth.uid() = user_id);
