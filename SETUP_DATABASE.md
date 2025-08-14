# 🗄️ Konfiguracja bazy danych Supabase

## Problem
Aplikacja pokazuje błędy: **"Could not find the table 'public.reading_history' in the schema cache"** i podobne, ponieważ brakuje tabel w bazie danych.

## ✅ Rozwiązanie - Utwórz tabele ręcznie

### 1. Przejdź do Supabase Dashboard
- Idź na: https://supabase.com/dashboard
- Zaloguj się do swojego konta
- Wybierz swój projekt

### 2. Otwórz SQL Editor
- Kliknij **"SQL Editor"** w menu bocznym
- Kliknij **"New Query"**

### 3. Skopiuj i uruchom SQL
Skopiuj **CAŁĄ** zawartość z pliku `supabase-schema.sql` i wklej do SQL Editor, następnie kliknij **"RUN"**.

**Alternatywnie**, możesz uruchomić uproszczoną wersję poniżej:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{
        "language": "pl",
        "max_articles": 6,
        "auto_translate": true,
        "auto_summarize": true,
        "max_translation_length": 1000
    }'::jsonb,
    settings JSONB DEFAULT '{
        "theme": "light",
        "notifications": true
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User RSS feeds table
CREATE TABLE IF NOT EXISTS user_feeds (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rss_url TEXT NOT NULL,
    custom_name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, rss_url)
);

-- User reading history table
CREATE TABLE IF NOT EXISTS reading_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    article_url TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    liked BOOLEAN DEFAULT false,
    UNIQUE(user_id, article_url)
);

-- User summaries table
CREATE TABLE IF NOT EXISTS user_summaries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    article_id TEXT NOT NULL,
    article_title TEXT,
    article_url TEXT,
    summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) 
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own feeds" ON user_feeds
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feeds" ON user_feeds
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feeds" ON user_feeds
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feeds" ON user_feeds
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own reading history" ON reading_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reading history" ON reading_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own summaries" ON user_summaries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own summaries" ON user_summaries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, display_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 4. Zweryfikuj utworzenie tabel
Po uruchomieniu SQL:
1. Przejdź do **"Table Editor"** w Supabase Dashboard  
2. Powinieneś zobaczyć tabele: `profiles`, `user_feeds`, `reading_history`, `user_summaries`

### 5. Odśwież aplikację
- Odśwież stronę aplikacji
- Dashboard powinien teraz działać bez błędów

## 🔧 Fallback (jeśli nadal są problemy)

Kod aplikacji już zawiera fallback - jeśli tabele nie istnieją, będą zwracane puste dane zamiast błędów.

## ✅ Status
Po wykonaniu powyższych kroków:
- ✅ Dashboard będzie działał
- ✅ Można będzie dodawać RSS feeds
- ✅ Historia czytania będzie śledzona  
- ✅ Streszczenia będą zapisywane