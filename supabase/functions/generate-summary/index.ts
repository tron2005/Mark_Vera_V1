import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { summaryType } = await req.json();
    
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    let summaryData = '';
    let systemPrompt = '';

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (summaryType === 'sleep') {
      // Načíst poslední spánek
      const { data: sleepData } = await supabaseClient
        .from('sleep_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('sleep_date', { ascending: false })
        .limit(1);

      if (sleepData && sleepData.length > 0) {
        const sleep = sleepData[0];
        summaryData = `Datum: ${sleep.sleep_date}
Celková doba spánku: ${sleep.duration_minutes} minut
Hluboký spánek: ${sleep.deep_sleep_minutes || 0} minut
REM spánek: ${sleep.rem_duration_minutes || 0} minut
Lehký spánek: ${sleep.light_sleep_minutes || 0} minut
Probuzení: ${sleep.awake_duration_minutes || 0} minut
Průměrný tep: ${sleep.hr_average || 'N/A'} bpm
Nejnižší tep: ${sleep.hr_lowest || 'N/A'} bpm
Dechová frekvence: ${sleep.respiration_rate || 'N/A'}
Kvalita: ${sleep.quality || 'N/A'}/100`;
      } else {
        summaryData = 'Žádná data o spánku nejsou k dispozici.';
      }

      systemPrompt = 'Jsi osobní trenér a spánkový kouč. Analyzuj data o spánku a poskytni stručné, jasné shrnutí v češtině. Zaměř se na kvalitu spánku, doporučení pro zlepšení a hodnocení jednotlivých fází spánku. Odpověz maximálně 5-7 větami.';

    } else if (summaryType === 'last_workout') {
      // Načíst poslední trénink ze Strava nebo Garmin
      const { data: stravaData } = await supabaseClient
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(1);

      const { data: garminData } = await supabaseClient
        .from('garmin_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(1);

      let latestActivity = null;
      if (stravaData && stravaData.length > 0 && garminData && garminData.length > 0) {
        latestActivity = new Date(stravaData[0].start_date) > new Date(garminData[0].start_date)
          ? { source: 'Strava', ...stravaData[0] }
          : { source: 'Garmin', ...garminData[0] };
      } else if (stravaData && stravaData.length > 0) {
        latestActivity = { source: 'Strava', ...stravaData[0] };
      } else if (garminData && garminData.length > 0) {
        latestActivity = { source: 'Garmin', ...garminData[0] };
      }

      if (latestActivity) {
        if (latestActivity.source === 'Strava') {
          summaryData = `Zdroj: ${latestActivity.source}
Název: ${latestActivity.name || latestActivity.activity_type}
Typ: ${latestActivity.activity_type}
Datum: ${latestActivity.start_date}
Vzdálenost: ${(latestActivity.distance_meters / 1000).toFixed(2)} km
Čas: ${Math.floor(latestActivity.elapsed_time_seconds / 60)} minut
Průměrný tep: ${latestActivity.average_heartrate || 'N/A'} bpm
Maximální tep: ${latestActivity.max_heartrate || 'N/A'} bpm
Kalorie: ${latestActivity.calories || 'N/A'} kcal
Převýšení: ${latestActivity.total_elevation_gain || 0} m`;
        } else {
          summaryData = `Zdroj: ${latestActivity.source}
Typ: ${latestActivity.activity_type}
Datum: ${latestActivity.start_date}
Vzdálenost: ${latestActivity.distance_km || 0} km
Čas: ${Math.floor((latestActivity.duration_seconds || 0) / 60)} minut
Průměrný tep: ${latestActivity.avg_heart_rate || 'N/A'} bpm
Maximální tep: ${latestActivity.max_heart_rate || 'N/A'} bpm
Kalorie: ${latestActivity.calories || 'N/A'} kcal
Převýšení: ${latestActivity.elevation_gain || 0} m`;
        }
      } else {
        summaryData = 'Žádné tréninkové aktivity nejsou k dispozici.';
      }

      systemPrompt = 'Jsi osobní fitness trenér. Analyzuj tréninková data a poskytni stručné hodnocení v češtině. Zaměř se na intenzitu tréninku, srdeční tep, výkon a případná doporučení. Odpověz maximálně 5-7 větami.';

    } else if (summaryType === 'weekly_overview') {
      // Načíst týdenní přehled
      const { data: sleepWeek } = await supabaseClient
        .from('sleep_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('sleep_date', weekAgo)
        .lte('sleep_date', today)
        .order('sleep_date', { ascending: false });

      const { data: stravaWeek } = await supabaseClient
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_date', weekAgo)
        .order('start_date', { ascending: false });

      const { data: garminWeek } = await supabaseClient
        .from('garmin_activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_date', weekAgo)
        .order('start_date', { ascending: false });

      const { data: healthWeek } = await supabaseClient
        .from('health_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('log_date', weekAgo)
        .order('log_date', { ascending: false });

      let weekSummary = `TÝDENNÍ PŘEHLED (${weekAgo} až ${today})\n\n`;

      if (sleepWeek && sleepWeek.length > 0) {
        const avgSleep = sleepWeek.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / sleepWeek.length;
        const avgQuality = sleepWeek.reduce((sum, s) => sum + (s.quality || 0), 0) / sleepWeek.length;
        weekSummary += `SPÁNEK:\n- Počet záznamů: ${sleepWeek.length}\n- Průměrná doba spánku: ${Math.round(avgSleep)} minut\n- Průměrná kvalita: ${Math.round(avgQuality)}/100\n\n`;
      }

      const totalActivities = (stravaWeek?.length || 0) + (garminWeek?.length || 0);
      if (totalActivities > 0) {
        const stravaDistance = stravaWeek?.reduce((sum, a) => sum + (a.distance_meters || 0), 0) || 0;
        const garminDistance = garminWeek?.reduce((sum, a) => sum + ((a.distance_km || 0) * 1000), 0) || 0;
        const totalDistance = (stravaDistance + garminDistance) / 1000;
        
        const stravaCalories = stravaWeek?.reduce((sum, a) => sum + (a.calories || 0), 0) || 0;
        const garminCalories = garminWeek?.reduce((sum, a) => sum + (a.calories || 0), 0) || 0;
        const totalCalories = stravaCalories + garminCalories;

        weekSummary += `TRÉNINKY:\n- Počet aktivit: ${totalActivities}\n- Celková vzdálenost: ${totalDistance.toFixed(2)} km\n- Celkové kalorie: ${totalCalories} kcal\n\n`;
      }

      if (healthWeek && healthWeek.length > 0) {
        weekSummary += `ZDRAVOTNÍ ZÁZNAMY:\n- Počet záznamů: ${healthWeek.length}\n`;
        healthWeek.slice(0, 3).forEach(h => {
          weekSummary += `- ${h.log_date}: ${h.condition_type} (závažnost: ${h.severity || 'N/A'})\n`;
        });
      }

      summaryData = weekSummary;
      systemPrompt = 'Jsi osobní fitness trenér a zdravotní poradce. Analyzuj týdenní data a poskytni komplexní přehled s trendy, pozitivy, oblastmi ke zlepšení a konkrétními doporučeními v češtině. Zaměř se na celkový obraz kondice, spánku a tréninku. Odpověz v 8-12 větách, strukturovaně.';
    }

    // Zavolat OpenAI API pro generování sumáře
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: summaryData }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', aiResponse.status, errorText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices[0].message.content;

    return new Response(
      JSON.stringify({ summary, rawData: summaryData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating summary:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
