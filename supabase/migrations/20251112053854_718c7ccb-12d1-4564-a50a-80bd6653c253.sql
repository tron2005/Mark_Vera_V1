-- Přidat nové sloupce do tabulky notes
ALTER TABLE public.notes 
ADD COLUMN due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN location TEXT,
ADD COLUMN reminder_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN recurrence TEXT;

-- Vytvořit index pro due_date pro rychlé vyhledávání úkolů podle data
CREATE INDEX idx_notes_due_date ON public.notes(due_date) WHERE due_date IS NOT NULL;

-- Vytvořit index pro reminder_date pro rychlé vyhledávání upomínek
CREATE INDEX idx_notes_reminder_date ON public.notes(reminder_date) WHERE reminder_date IS NOT NULL;