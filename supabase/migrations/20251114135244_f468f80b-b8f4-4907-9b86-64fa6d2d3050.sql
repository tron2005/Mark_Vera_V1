-- Přidat sloupec BMR do profiles tabulky
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bmr numeric;