-- Přidat sloupec image_url do tabulky messages pro ukládání obrázků
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;