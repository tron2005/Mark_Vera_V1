-- Automatické čištění starých logů
-- Logy starší než 30 dní budou smazány

-- Funkce pro čištění starých logů
create or replace function clean_old_logs()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.logs
  where created_at < now() - interval '30 days';
end;
$$;

-- Spustit při každém deployi (testovací běh)
select clean_old_logs();

-- Note: Pro pravidelné spouštění každý den můžeš použít pg_cron extension
-- nebo external cron job. Pro jednoduchost můžeš volat manuálně:
-- SELECT clean_old_logs();

comment on function clean_old_logs() is 'Čistí logy starší než 30 dní. Pro automatické spouštění použij pg_cron nebo external scheduler.';
