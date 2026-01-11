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
    const { city, country } = await req.json().catch(() => ({}));
    
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Načíst lokaci z profilu uživatele
    let userCity = city;
    if (!userCity) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('location')
        .eq('user_id', user.id)
        .maybeSingle();
      
      userCity = profile?.location || "Plzeň";
    }
    
    const userCountry = country || "CZ";

    const OPENWEATHER_API_KEY = Deno.env.get('OPENWEATHER_API_KEY');
    if (!OPENWEATHER_API_KEY) throw new Error('OPENWEATHER_API_KEY is not configured');

    // Získat aktuální počasí z OpenWeatherMap
    const weatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${userCity},${userCountry}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=cs`
    );

    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      console.error('OpenWeatherMap error:', weatherResponse.status, errorText);
      throw new Error(`Weather API error: ${weatherResponse.status}`);
    }

    const weatherData = await weatherResponse.json();
    
    const temp = weatherData.main.temp;
    const feelsLike = weatherData.main.feels_like;
    const humidity = weatherData.main.humidity;
    const windSpeed = weatherData.wind.speed;
    const description = weatherData.weather[0].description;
    const icon = weatherData.weather[0].icon;
    const rain = weatherData.rain?.['1h'] || 0;

    // Připravit data pro AI analýzu
    const weatherSummary = `Aktuální počasí v ${userCity}:
- Teplota: ${temp}°C (pocitově ${feelsLike}°C)
- Podmínky: ${description}
- Vlhkost: ${humidity}%
- Vítr: ${windSpeed} m/s
- Déšť (1h): ${rain} mm`;

    // Zavolat OpenAI API pro doporučení
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
          { 
            role: 'system', 
            content: 'Jsi běžecký trenér. Na základě počasí poskytni stručné doporučení (3-5 vět), zda je vhodné jít běhat, jaké tempo volit, co si vzít na sebe, a další praktické rady. Odpovídej v češtině, přátelsky ale prakticky.' 
          },
          { role: 'user', content: weatherSummary }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', aiResponse.status, errorText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const recommendation = aiData.choices[0].message.content;

    return new Response(
      JSON.stringify({ 
        weather: {
          temp,
          feelsLike,
          humidity,
          windSpeed,
          description,
          icon,
          rain,
          city: userCity
        },
        recommendation 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error getting weather recommendation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
