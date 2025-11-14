import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendStatsEmailRequest {
  recipientEmail: string;
  statsType: "sleep" | "fitness" | "hrv" | "heart_rate" | "body_composition";
  days?: number;
  startDate?: string;
  endDate?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError);
      throw new Error("Unauthorized");
    }

    const { recipientEmail, statsType, days = 7, startDate, endDate }: SendStatsEmailRequest = await req.json();

    console.log(`Sending ${statsType} stats email to ${recipientEmail} for ${days} days`);

    let emailSubject = "";
    let emailContent = "";

    // Calculate date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - (days * 24 * 60 * 60 * 1000));

    if (statsType === "sleep") {
      const { data: sleepData, error } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("sleep_date", start.toISOString().split('T')[0])
        .lte("sleep_date", end.toISOString().split('T')[0])
        .order("sleep_date", { ascending: false });

      if (error) throw new Error("Chyba při načítání dat spánku");

      emailSubject = `Statistiky spánku za posledních ${days} dní`;
      emailContent = formatSleepStats(sleepData || [], start, end);

    } else if (statsType === "hrv") {
      const { data: hrvData, error } = await supabase
        .from("hrv_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", start.toISOString().split('T')[0])
        .lte("date", end.toISOString().split('T')[0])
        .order("date", { ascending: false });

      if (error) throw new Error("Chyba při načítání HRV dat");

      emailSubject = `Statistiky HRV za posledních ${days} dní`;
      emailContent = formatHRVStats(hrvData || [], start, end);

    } else if (statsType === "heart_rate") {
      const { data: hrData, error } = await supabase
        .from("heart_rate_rest")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", start.toISOString().split('T')[0])
        .lte("date", end.toISOString().split('T')[0])
        .order("date", { ascending: false });

      if (error) throw new Error("Chyba při načítání klidové srdeční frekvence");

      emailSubject = `Klidová srdeční frekvence za posledních ${days} dní`;
      emailContent = formatHeartRateStats(hrData || [], start, end);

    } else if (statsType === "body_composition") {
      const { data: bodyData, error } = await supabase
        .from("body_composition")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", start.toISOString().split('T')[0])
        .lte("date", end.toISOString().split('T')[0])
        .order("date", { ascending: false });

      if (error) throw new Error("Chyba při načítání tělesného složení");

      emailSubject = `Tělesné složení za posledních ${days} dní`;
      emailContent = formatBodyCompositionStats(bodyData || [], start, end);

    } else if (statsType === "fitness") {
      // Get both Strava and Garmin activities
      const { data: stravaData, error: stravaError } = await supabase
        .from("strava_activities")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_date", start.toISOString())
        .lte("start_date", end.toISOString())
        .order("start_date", { ascending: false });

      const { data: garminData, error: garminError } = await supabase
        .from("garmin_activities")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_date", start.toISOString())
        .lte("start_date", end.toISOString())
        .order("start_date", { ascending: false });

      if (stravaError && garminError) {
        throw new Error("Chyba při načítání fitness aktivit");
      }

      emailSubject = `Fitness statistiky za posledních ${days} dní`;
      emailContent = formatFitnessStats(stravaData || [], garminData || [], start, end);
    }

    const emailResponse = await resend.emails.send({
      from: "M.A.R.K./V.E.R.A. <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: emailSubject,
      html: emailContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.data?.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-stats-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function formatSleepStats(sleepData: any[], start: Date, end: Date): string {
  if (sleepData.length === 0) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">📊 Statistiky spánku</h1>
        <p>Žádná data spánku za období ${start.toLocaleDateString('cs-CZ')} - ${end.toLocaleDateString('cs-CZ')}.</p>
      </div>
    `;
  }

  const avgDuration = sleepData.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / sleepData.length;
  const avgDeep = sleepData.reduce((sum, s) => sum + (s.deep_sleep_minutes || 0), 0) / sleepData.length;
  const avgRem = sleepData.reduce((sum, s) => sum + (s.rem_duration_minutes || 0), 0) / sleepData.length;
  const avgQuality = sleepData.reduce((sum, s) => sum + (s.quality || 0), 0) / sleepData.length;

  let tableRows = sleepData.map(s => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${new Date(s.sleep_date).toLocaleDateString('cs-CZ')}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${Math.round(s.duration_minutes / 60 * 10) / 10} h</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${s.deep_sleep_minutes || 0} min</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${s.rem_duration_minutes || 0} min</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${s.quality || 'N/A'}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">😴 Statistiky spánku</h1>
      <p style="color: #666;">Období: ${start.toLocaleDateString('cs-CZ')} - ${end.toLocaleDateString('cs-CZ')}</p>
      
      <h2 style="color: #555; margin-top: 30px;">📈 Průměrné hodnoty</h2>
      <ul style="color: #666;">
        <li><strong>Délka spánku:</strong> ${Math.round(avgDuration / 60 * 10) / 10} hodin</li>
        <li><strong>Hluboký spánek:</strong> ${Math.round(avgDeep)} minut</li>
        <li><strong>REM spánek:</strong> ${Math.round(avgRem)} minut</li>
        <li><strong>Kvalita:</strong> ${Math.round(avgQuality)}/100</li>
      </ul>

      <h2 style="color: #555; margin-top: 30px;">📋 Detailní data</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Datum</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Délka</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Hluboký</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">REM</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Kvalita</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <p style="color: #999; margin-top: 30px; font-size: 12px;">
        Tento email byl automaticky vygenerován M.A.R.K./V.E.R.A. fitness asistentem.
      </p>
    </div>
  `;
}

function formatHRVStats(hrvData: any[], start: Date, end: Date): string {
  if (hrvData.length === 0) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">📊 HRV Statistiky</h1>
        <p>Žádná HRV data za období ${start.toLocaleDateString('cs-CZ')} - ${end.toLocaleDateString('cs-CZ')}.</p>
      </div>
    `;
  }

  const avgHRV = hrvData.reduce((sum, h) => sum + (h.hrv || 0), 0) / hrvData.length;
  const maxHRV = Math.max(...hrvData.map(h => h.hrv || 0));
  const minHRV = Math.min(...hrvData.map(h => h.hrv || 0));

  let tableRows = hrvData.map(h => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${new Date(h.date).toLocaleDateString('cs-CZ')}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${h.hrv} ms</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${h.metric || 'N/A'}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${h.source || 'N/A'}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">❤️ HRV Statistiky</h1>
      <p style="color: #666;">Období: ${start.toLocaleDateString('cs-CZ')} - ${end.toLocaleDateString('cs-CZ')}</p>
      
      <h2 style="color: #555; margin-top: 30px;">📈 Souhrn</h2>
      <ul style="color: #666;">
        <li><strong>Průměrné HRV:</strong> ${Math.round(avgHRV)} ms</li>
        <li><strong>Maximum:</strong> ${maxHRV} ms</li>
        <li><strong>Minimum:</strong> ${minHRV} ms</li>
        <li><strong>Počet měření:</strong> ${hrvData.length}</li>
      </ul>

      <h2 style="color: #555; margin-top: 30px;">📋 Detailní data</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Datum</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">HRV</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Metrika</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Zdroj</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <p style="color: #999; margin-top: 30px; font-size: 12px;">
        Tento email byl automaticky vygenerován M.A.R.K./V.E.R.A. fitness asistentem.
      </p>
    </div>
  `;
}

function formatHeartRateStats(hrData: any[], start: Date, end: Date): string {
  if (hrData.length === 0) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">📊 Klidová srdeční frekvence</h1>
        <p>Žádná data za období ${start.toLocaleDateString('cs-CZ')} - ${end.toLocaleDateString('cs-CZ')}.</p>
      </div>
    `;
  }

  const avgHR = hrData.reduce((sum, h) => sum + (h.heart_rate || 0), 0) / hrData.length;
  const maxHR = Math.max(...hrData.map(h => h.heart_rate || 0));
  const minHR = Math.min(...hrData.map(h => h.heart_rate || 0));

  let tableRows = hrData.map(h => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${new Date(h.date).toLocaleDateString('cs-CZ')}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${h.heart_rate} bpm</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${h.time || 'N/A'}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">💓 Klidová srdeční frekvence</h1>
      <p style="color: #666;">Období: ${start.toLocaleDateString('cs-CZ')} - ${end.toLocaleDateString('cs-CZ')}</p>
      
      <h2 style="color: #555; margin-top: 30px;">📈 Souhrn</h2>
      <ul style="color: #666;">
        <li><strong>Průměrná TF:</strong> ${Math.round(avgHR)} bpm</li>
        <li><strong>Maximum:</strong> ${maxHR} bpm</li>
        <li><strong>Minimum:</strong> ${minHR} bpm</li>
        <li><strong>Počet měření:</strong> ${hrData.length}</li>
      </ul>

      <h2 style="color: #555; margin-top: 30px;">📋 Detailní data</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Datum</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Tepová frekvence</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Čas</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <p style="color: #999; margin-top: 30px; font-size: 12px;">
        Tento email byl automaticky vygenerován M.A.R.K./V.E.R.A. fitness asistentem.
      </p>
    </div>
  `;
}

function formatBodyCompositionStats(bodyData: any[], start: Date, end: Date): string {
  if (bodyData.length === 0) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">📊 Tělesné složení</h1>
        <p>Žádná data za období ${start.toLocaleDateString('cs-CZ')} - ${end.toLocaleDateString('cs-CZ')}.</p>
      </div>
    `;
  }

  const avgWeight = bodyData.reduce((sum, b) => sum + (b.weight_kg || 0), 0) / bodyData.length;
  const avgFat = bodyData.reduce((sum, b) => sum + (b.fat_percentage || 0), 0) / bodyData.length;
  const avgMuscle = bodyData.reduce((sum, b) => sum + (b.muscle_percentage || 0), 0) / bodyData.length;

  let tableRows = bodyData.map(b => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${new Date(b.date).toLocaleDateString('cs-CZ')}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${b.weight_kg} kg</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${b.fat_percentage || 'N/A'}%</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${b.muscle_percentage || 'N/A'}%</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${b.water_percentage || 'N/A'}%</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">⚖️ Tělesné složení</h1>
      <p style="color: #666;">Období: ${start.toLocaleDateString('cs-CZ')} - ${end.toLocaleDateString('cs-CZ')}</p>
      
      <h2 style="color: #555; margin-top: 30px;">📈 Průměrné hodnoty</h2>
      <ul style="color: #666;">
        <li><strong>Hmotnost:</strong> ${Math.round(avgWeight * 10) / 10} kg</li>
        <li><strong>Tuk:</strong> ${Math.round(avgFat * 10) / 10}%</li>
        <li><strong>Svaly:</strong> ${Math.round(avgMuscle * 10) / 10}%</li>
      </ul>

      <h2 style="color: #555; margin-top: 30px;">📋 Detailní data</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Datum</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Hmotnost</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Tuk</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Svaly</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Voda</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <p style="color: #999; margin-top: 30px; font-size: 12px;">
        Tento email byl automaticky vygenerován M.A.R.K./V.E.R.A. fitness asistentem.
      </p>
    </div>
  `;
}

function formatFitnessStats(stravaData: any[], garminData: any[], start: Date, end: Date): string {
  const allActivities = [...stravaData, ...garminData];
  
  if (allActivities.length === 0) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">📊 Fitness statistiky</h1>
        <p>Žádné aktivity za období ${start.toLocaleDateString('cs-CZ')} - ${end.toLocaleDateString('cs-CZ')}.</p>
      </div>
    `;
  }

  const totalDistance = allActivities.reduce((sum, a) => {
    return sum + ((a.distance_meters || 0) / 1000 || (a.distance_km || 0));
  }, 0);

  const totalTime = allActivities.reduce((sum, a) => {
    return sum + ((a.moving_time_seconds || 0) / 3600 || (a.duration_seconds || 0) / 3600);
  }, 0);

  const totalCalories = allActivities.reduce((sum, a) => sum + (a.calories || 0), 0);

  let tableRows = allActivities
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
    .map(a => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${new Date(a.start_date).toLocaleDateString('cs-CZ')}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${a.name || a.activity_type}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${Math.round((a.distance_meters / 1000 || a.distance_km || 0) * 10) / 10} km</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${Math.round((a.moving_time_seconds / 60 || a.duration_seconds / 60 || 0))} min</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${a.calories || 'N/A'} kcal</td>
      </tr>
    `).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">🏃 Fitness statistiky</h1>
      <p style="color: #666;">Období: ${start.toLocaleDateString('cs-CZ')} - ${end.toLocaleDateString('cs-CZ')}</p>
      
      <h2 style="color: #555; margin-top: 30px;">📈 Souhrn</h2>
      <ul style="color: #666;">
        <li><strong>Celková vzdálenost:</strong> ${Math.round(totalDistance * 10) / 10} km</li>
        <li><strong>Celkový čas:</strong> ${Math.round(totalTime * 10) / 10} hodin</li>
        <li><strong>Celkové kalorie:</strong> ${Math.round(totalCalories)} kcal</li>
        <li><strong>Počet aktivit:</strong> ${allActivities.length}</li>
      </ul>

      <h2 style="color: #555; margin-top: 30px;">📋 Detailní seznam aktivit</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Datum</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Typ</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Vzdálenost</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Čas</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Kalorie</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <p style="color: #999; margin-top: 30px; font-size: 12px;">
        Tento email byl automaticky vygenerován M.A.R.K./V.E.R.A. fitness asistentem.
      </p>
    </div>
  `;
}

serve(handler);
