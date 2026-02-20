import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Rocket, Info } from "lucide-react";

export const AboutCard = () => {
    return (
        <Card className="border-t-4 border-t-primary">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        O aplikaci & Roadmapa
                    </CardTitle>
                    <Badge variant="outline" className="text-sm px-3 py-1 bg-primary/10">Verze 1.2.0</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    Vizualizace makroživin, chytřejší AI a opravy Google Calendar
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Current Features */}
                <div>
                    <h3 className="flex items-center gap-2 font-semibold mb-3 text-green-600 dark:text-green-500">
                        <Check className="h-4 w-4" />
                        Aktuální funkce
                    </h3>
                    <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-1 md:grid-cols-2">
                        <li>🤖 Dva AI asistenti (M.A.R.K. fitness & V.E.R.A. wellness)</li>
                        <li>🔊 Text-to-speech s vlastním výběrem hlasů</li>
                        <li>🏃 Strava integrace - import aktivit a statistik</li>
                        <li>👥 Správa Strava testerů - každý vlastní API</li>
                        <li>🔐 Multi-user autentizace - izolovaná data</li>
                        <li>💪 Import z Garmin (.FIT) - aktivity, spánek, HRV</li>
                        <li>📊 Import z Runalyze - kompletní běžecká historie</li>
                        <li>💍 Import z RingConn - spánek, HRV, kroky, kalorie</li>
                        <li>😴 Sledování spánku s pokročilými metrikami</li>
                        <li>❤️ Monitoring HRV a klidové srdeční frekvence</li>
                        <li>⚖️ Tělesné složení a BMI tracking</li>
                        <li>🎯 Správa závodních cílů a periodizace</li>
                        <li>📈 Multi-source grafy a vizualizace</li>
                        <li>🧬 Longevity karta - biologický věk, VO2max</li>
                        <li>💪 3D vizualizace svalových partií</li>
                        <li>📝 Chytré poznámky s AI analýzou</li>
                        <li>📅 Google Calendar integrace</li>
                        <li>📧 Export poznámek a statistik emailem</li>
                        <li>🧮 BMR kalkulačka podle pohlaví a věku</li>
                        <li>🍽️ Import kalorií z Kalorických Tabulek</li>
                        <li>📉 Plán hubnutí s vizualizací pokroku</li>
                        <li>📚 Tréninková knihovna (BodyCombat, Běh)</li>
                        <li>📊 Vizualizace makroživin - týdenní trendy a cíle</li>
                        <li>🧠 AI s kontextem - vidí aktivity, výživu a kondici</li>
                    </ul>
                </div>

                <div className="h-px bg-border" />

                {/* Planned Features */}
                <div>
                    <h3 className="flex items-center gap-2 font-semibold mb-3 text-blue-600 dark:text-blue-500">
                        <Rocket className="h-4 w-4" />
                        Plánované funkce (Roadmapa)
                    </h3>
                    
                    <div className="space-y-4 text-sm text-muted-foreground">
                        <div>
                            <strong className="block text-foreground mb-1">📥 Import a správa dat</strong>
                            <ul className="list-disc list-inside space-y-1 ml-1">
                                <li>Nahrávání textových souborů z Runalyze</li>
                                <li>Integrace s Intervals.icu</li>
                                <li>Detekce duplicit při importu dat</li>
                                <li>Integrace s Health Connect</li>
                            </ul>
                        </div>

                        <div>
                            <strong className="block text-foreground mb-1">🏋️ Tréninkové plány a výživa</strong>
                            <ul className="list-disc list-inside space-y-1 ml-1">
                                <li>AI generování tréninkových plánů (hubnutí/kondice)</li>
                                <li>Kalorické tabulky a tracking příjmu přímo v aplikaci</li>
                                <li>Cílová hmotnost s predikcí data dosažení</li>
                                <li>Automatická kompenzace (oslavy, nemoci) v plánu</li>
                                <li>AI doporučení suplementů a dávkování</li>
                            </ul>
                        </div>

                        <div>
                            <strong className="block text-foreground mb-1">📅 Kalendář a plánování</strong>
                            <ul className="list-disc list-inside space-y-1 ml-1">
                                <li>Vizualizace dodržování plánu v kalendáři (úspěch/neúspěch)</li>
                                <li>Predikce dosažení cíle s ohledem na životní události</li>
                                <li>Automatické přeplánování při nemoci</li>
                            </ul>
                        </div>

                        <div>
                            <strong className="block text-foreground mb-1">📊 Vizualizace a statistiky</strong>
                            <ul className="list-disc list-inside space-y-1 ml-1">
                                <li>Vyobrazení aktivit dle časového období (týden/měsíc)</li>
                                <li>AI shrnutí ke každému grafu s analýzou trendů</li>
                                <li>Počasí na základě umístění tréninku (bez GPS)</li>
                                <li>3D figurína svalových partií (předek/zadek)</li>
                                <li>Interaktivní barevné kódování svalů (aktivní/nevyužité)</li>
                            </ul>
                        </div>
                        
                        <div>
                            <strong className="block text-foreground mb-1">🚗 Správa vozidel</strong>
                            <ul className="list-disc list-inside space-y-1 ml-1">
                                <li>Údaje o vozidlech (TK, pojistné, servisy)</li>
                                <li>Typ oleje, pneumatiky, připomínky</li>
                            </ul>
                        </div>

                         <div>
                            <strong className="block text-foreground mb-1">📚 Vzdělávání (M.A.R.K. Knowledge)</strong>
                            <ul className="list-disc list-inside space-y-1 ml-1">
                                <li>Upomínky Duolingo, Udemy</li>
                                <li>Sledování času na učení a pokroku</li>
                                <li>Vlastní záložka pro jazykového lektora</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
