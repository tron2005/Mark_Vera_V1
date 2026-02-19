-- Přidat sloupce do profiles pro nastavení
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS voice_preference TEXT DEFAULT 'alloy',
ADD COLUMN IF NOT EXISTS custom_instructions TEXT DEFAULT 'Buď přátelský a pomáhej mi organizovat poznámky. Odpovídej stručně a jasně.';

-- Přidat index pro rychlejší vyhledávání
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);