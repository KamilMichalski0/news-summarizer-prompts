# News Summarizer - Konfiguracja Supabase

## Przegląd zmian

Aplikacja została całkowicie przeprojektowana z obsługą użytkowników poprzez Supabase. Główne zmiany:

- **Uwierzytelnianie**: Wszystkie endpointy wymagają logowania
- **Kontekst użytkownika**: Spersonalizowane RSS feedy, historia, streszczenia
- **Dashboard**: Zarządzanie feedami, ustawienia, historia
- **Bezpieczeństwo**: JWT validation, user-specific rate limiting

## Konfiguracja Supabase

### 1. Utwórz projekt Supabase

1. Idź na [supabase.com](https://supabase.com)
2. Utwórz nowy projekt
3. Zanotuj `Project URL` i `anon public` klucz

### 2. Skonfiguruj bazę danych

1. Otwórz SQL Editor w Supabase Dashboard
2. Wklej i wykonaj zawartość pliku `supabase-schema.sql`
3. Sprawdź czy tabele zostały utworzone:
   - `profiles`
   - `user_feeds` 
   - `reading_history`
   - `user_summaries`

### 3. Skonfiguruj uwierzytelnianie

W Supabase Dashboard → Authentication → Settings:

1. **Site URL**: `http://localhost:3000` (dla developmentu)
2. **Redirect URLs**: Dodaj `http://localhost:3000`
3. **Email Auth**: Włącz email/password authentication
4. **Email Templates**: Opcjonalnie dostosuj szablony emaili

### 4. Zmienne środowiskowe

Utwórz/zaktualizuj plik `.env`:

```env
# Existing API keys
DEEPL_API_KEY=your_deepl_key_here
OPENAI_API_KEY=your_openai_key_here

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Server Configuration
PORT=3000
NODE_ENV=development
```

## Uruchomienie aplikacji

```bash
# Zainstaluj zależności (jeśli jeszcze nie)
npm install

# Uruchom w trybie development
npm run dev

# Lub w trybie produkcyjnym
npm start
```

## Nowe endpointy API

### Uwierzytelnianie
- Wszystkie endpointy wymagają nagłówka: `Authorization: Bearer <jwt_token>`
- Token uzyskasz poprzez logowanie w interfejsie

### User Management
- `GET /api/user/profile` - Profil użytkownika
- `PUT /api/user/profile` - Aktualizacja profilu
- `GET /api/user/dashboard` - Dane dashboard'u
- `DELETE /api/user/account` - Usunięcie konta

### RSS Feeds
- `GET /api/user/feeds` - Lista RSS feedów użytkownika
- `POST /api/user/feeds` - Dodanie nowego RSS feed'u
- `DELETE /api/user/feeds/:feedId` - Usunięcie RSS feed'u

### Historia i streszczenia
- `GET /api/user/history` - Historia odczytanych artykułów
- `POST /api/user/history/read` - Oznaczenie jako przeczytane
- `GET /api/user/summaries` - Streszczenia użytkownika

### Newsy (zmienione)
- `GET /api/news` - Spersonalizowane newsy z feedów użytkownika
- `POST /api/news/process` - Przetwarzanie pojedynczego artykułu

### Tłumaczenia (ulepszone)
- `POST /api/translate` - Tłumaczenie z preferencjami użytkownika
- `GET /api/translate/usage` - Statystyki użycia dla użytkownika
- `GET /api/translate/languages` - Dostępne języki

## Nowy interfejs

### Logowanie/Rejestracja
- Modal po załadowaniu strony
- Przełączanie między logowaniem a rejestracją
- Obsługa błędów i powiadomień

### Dashboard użytkownika
- **RSS Feedy**: Zarządzanie subskrybowanymi źródłami
- **Historia**: Przeczytane artykuły z możliwością oznaczania jako ulubione
- **Streszczenia**: Zapisane streszczenia artykułów
- **Ustawienia**: Preferencje języka, auto-tłumaczenie, auto-streszczanie

### Spersonalizowane newsy
- Wyświetlanie artykułów z feedów użytkownika
- Sortowanie chronologiczne
- Integracja z historią odczytanych

## Rate limiting

- **Globalne**: 50 requestów/15min na użytkownika (produkcja)
- **User-specific**: Osobne limity per użytkownik
- **Identyfikacja**: Po `user_id` zamiast IP

## Bezpieczeństwo

- **Row Level Security**: Każdy użytkownik widzi tylko swoje dane
- **JWT Validation**: Weryfikacja tokenów Supabase
- **CORS**: Zaktualizowane dla Supabase URLs
- **Input Validation**: Rozszerzona dla nowych endpointów

## Testowanie

1. **Utwórz konto**: Rejestruj się przez interfejs
2. **Dodaj RSS feed**: Użyj dashboard'u do dodania BBC News
3. **Pobierz newsy**: Sprawdź czy artykuły są spersonalizowane
4. **Przetestuj tłumaczenie**: Użyj formularza tłumaczenia
5. **Sprawdź historię**: Czy artykuły są zapisywane w historii

## Przykładowe dane testowe

Po utworzeniu użytkownika możesz wykonać w SQL Editor:

```sql
-- Zastąp 'your-email@example.com' swoim email'em
SELECT create_sample_user_data('your-email@example.com');
```

To doda przykładowe RSS feedy i historię.

## Troubleshooting

### Błędy połączenia z Supabase
1. Sprawdź `SUPABASE_URL` i `SUPABASE_ANON_KEY`
2. Upewnij się że projekt Supabase jest aktywny
3. Sprawdź logi serwera (`logs/error.log`)

### Problemy z uwierzytelnianiem
1. Sprawdź czy tabele zostały utworzone poprawnie
2. Zweryfikuj RLS policies w Supabase Dashboard
3. Sprawdź czy email/password auth jest włączony

### Brak danych użytkownika
1. Upewnij się że trigger `on_auth_user_created` działa
2. Sprawdź czy profil został utworzony w tabeli `profiles`
3. Sprawdź logi aplikacji

### Performance
- Indeksy zostały automatycznie utworzone
- Dla większej liczby użytkowników rozważ connection pooling
- Monitoruj usage w Supabase Dashboard

## Migracja danych

Jeśli masz istniejące dane z poprzedniej wersji:
1. Utwórz użytkownika testowego
2. Ręcznie dodaj RSS feedy przez dashboard
3. Historia będzie budowana na nowo podczas użytkowania

Aplikacja nie zachowuje backward compatibility - to całkowita migracja na model user-centric.