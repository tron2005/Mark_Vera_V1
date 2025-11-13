const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold text-foreground mb-8">
          Zásady ochrany osobních údajů pro MarkVera Sync App
        </h1>
        
        <div className="prose prose-lg max-w-none text-foreground">
          <p className="text-muted-foreground mb-6">
            Tento dokument popisuje, jak aplikace MarkVera Sync App ("Aplikace"), 
            provozovaná M.A.R.K./V.E.R.A., shromažďuje, používá a chrání osobní a aktivní data uživatelů.
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Shromažďovaná data</h2>
            <p className="mb-4">
              Aplikace MarkVera Sync App shromažďuje data pouze se souhlasem uživatele, 
              a to prostřednictvím připojení k rozhraním API třetích stran (Strava, Garmin Connect).
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Identifikační údaje:</strong> Váš unikátní ID kód (Athlete ID, User ID) 
                ze služeb Strava a Garmin Connect.
              </li>
              <li>
                <strong>Data o aktivitách (Active Data):</strong> Čas, datum, typ aktivity, 
                vzdálenost, trasa (GPS souřadnice) a související metriky (např. srdeční tep, kadence) 
                nahrané prostřednictvím těchto služeb.
              </li>
              <li>
                <strong>Ověřovací tokeny (Tokens):</strong> Přístupové tokeny (Access Tokens) 
                a obnovovací tokeny (Refresh Tokens), které jsou nezbytné pro komunikaci se službami 
                Strava a Garmin. Tyto tokeny jsou bezpečně šifrovány a ukládány.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Použití dat</h2>
            <p className="mb-4">
              Shromážděná data jsou použita výhradně k následujícím účelům:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Synchronizace:</strong> Pro spárování a automatickou synchronizaci 
                vašich aktivit mezi službami Garmin Connect a Strava.
              </li>
              <li>
                <strong>Zobrazení:</strong> Pro zobrazení vašich aktivit a tréninkových statistik 
                v rámci Aplikace.
              </li>
              <li>
                <strong>Provoz a údržba:</strong> Pro technické zabezpečení a provoz Aplikace.
              </li>
            </ul>
            <p className="mt-4">
              Data nejsou nikdy prodávána, sdílena s reklamními partnery ani využívána k jiným účelům 
              než ke synchronizaci, k níž dal uživatel výslovný souhlas.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Ochrana a ukládání dat</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Zabezpečení:</strong> Data jsou ukládána na bezpečných serverech 
                (Lovable/Supabase) a přenos je šifrován (SSL/TLS). Ověřovací tokeny jsou chráněny 
                kryptograficky.
              </li>
              <li>
                <strong>Doba uložení:</strong> Data jsou uchovávána po dobu, kdy máte aktivní účet 
                v Aplikaci. Po smazání účtu nebo zrušení propojení se službami jsou veškeré uložené 
                ověřovací tokeny a s nimi spojená data smazána do 30 dnů.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Souhlas a odvolání souhlasu</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Souhlas:</strong> Připojením vašeho účtu Garmin Connect nebo Strava 
                udělujete Aplikaci souhlas se shromažďováním a zpracováním vašich dat pro účely 
                popsané v bodě 2.
              </li>
              <li>
                <strong>Odvolání souhlasu:</strong> Svůj souhlas můžete kdykoliv odvolat odpojením 
                Aplikace buď v jejím nastavení, nebo přímo v nastavení propojených aplikací na 
                platformách Garmin Connect a Strava.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Kontakt</h2>
            <p>
              Máte-li jakékoli dotazy ohledně těchto Zásad ochrany osobních údajů nebo zpracování 
              vašich dat, kontaktujte nás na:
            </p>
            <p className="mt-4">
              <strong>E-mail:</strong> z.sailer@gmail.com
            </p>
          </section>

          <section className="mt-8 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Datum účinnosti: 13. listopadu 2025
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
