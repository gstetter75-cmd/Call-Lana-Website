/**
 * ============================================================
 * CALL LANA – Dashboard Backend Service
 * ============================================================
 *
 * Standalone-Modul für alle Dashboard-KPIs.
 * Funktioniert mit jedem Frontend (HTML, React, Vue, etc.)
 *
 * NUTZUNG:
 *   1. Supabase JS CDN oder npm einbinden
 *   2. Diese Datei laden
 *   3. Funktionen aufrufen:
 *
 *      const kpis = await Dashboard.getKPIs();
 *      const usage = await Dashboard.getUsageOverTime();
 *
 * ============================================================
 */

// ============================================================
// SUPABASE CLIENT
// ============================================================
const SUPABASE_URL = 'https://dtfbwqborzjjhqwtobhl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Dbvx3YEyG9LnrL2moVd0NQ_5VF48jos';

// Wenn supabase-js per CDN geladen wird → window.supabase
// Wenn per npm → import { createClient } from '@supabase/supabase-js'
const _sb = (typeof window !== 'undefined' && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null; // Für Node.js-Nutzung: hier manuell setzen

/**
 * Gibt den Supabase Client zurück.
 * Wirft einen Fehler wenn nicht initialisiert.
 */
function getClient() {
  if (!_sb) throw new Error('[Dashboard] Supabase Client nicht initialisiert. Bitte supabase-js einbinden.');
  return _sb;
}


// ============================================================
// HILFSFUNKTIONEN
// ============================================================

/**
 * Holt die user_id des aktuell eingeloggten Users.
 * Gibt null zurück wenn nicht eingeloggt.
 */
async function getCurrentUserId() {
  try {
    const { data: { session }, error } = await getClient().auth.getSession();
    if (error) throw error;
    return session?.user?.id || null;
  } catch (err) {
    console.error('[Dashboard] Session-Fehler:', err.message);
    return null;
  }
}

/**
 * Holt das volle User-Objekt (inkl. Metadaten).
 */
async function getCurrentUser() {
  try {
    const { data: { user }, error } = await getClient().auth.getUser();
    if (error) throw error;
    return user;
  } catch (err) {
    console.error('[Dashboard] User-Fehler:', err.message);
    return null;
  }
}

/**
 * Standardisiertes Ergebnis-Objekt.
 */
function ok(data) {
  return { success: true, data };
}
function fail(message, details) {
  return { success: false, error: message, details: details || null };
}

/**
 * Gibt den 1. Tag des aktuellen Monats als ISO-String zurück.
 */
function startOfMonth(date) {
  const d = date ? new Date(date) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

/**
 * Gibt den letzten Tag des aktuellen Monats als ISO-String zurück.
 */
function endOfMonth(date) {
  const d = date ? new Date(date) : new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
}

/**
 * Datum vor X Tagen als ISO-String.
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Formatiert Sekunden als "M:SS".
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}


// ============================================================
// KERN-FUNKTIONEN
// ============================================================

/**
 * getDashboardKPIs()
 * ------------------
 * Holt alle Haupt-KPIs für den aktuellen Monat:
 *   - Anrufe gesamt
 *   - Gesamtdauer
 *   - Durchschnittsdauer
 *   - Gesamtkosten
 *   - Anzahl Assistenten
 *   - Anzahl SMS
 *   - Anzahl Leads
 *
 * @param {Object} options - { month: Date } (optional, default = jetzt)
 * @returns {Object} { success, data }
 */
async function getDashboardKPIs(options = {}) {
  const userId = await getCurrentUserId();
  if (!userId) return fail('Nicht eingeloggt.');

  const from = startOfMonth(options.month);
  const to = endOfMonth(options.month);

  try {
    const sb = getClient();

    // Alle Abfragen parallel ausführen
    const [callsRes, assistantsRes, smsRes, leadsRes] = await Promise.all([

      // 1. Calls diesen Monat
      sb.from('calls')
        .select('id, duration_seconds, cost, status, direction')
        .eq('user_id', userId)
        .gte('created_at', from)
        .lte('created_at', to),

      // 2. Alle Assistenten (nicht monatsgebunden)
      sb.from('assistants')
        .select('id, status')
        .eq('user_id', userId),

      // 3. SMS diesen Monat
      sb.from('sms_messages')
        .select('id, cost')
        .eq('user_id', userId)
        .gte('created_at', from)
        .lte('created_at', to),

      // 4. Leads diesen Monat
      sb.from('leads')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', from)
        .lte('created_at', to),
    ]);

    // Fehler prüfen
    if (callsRes.error) throw new Error('Calls: ' + callsRes.error.message);
    if (assistantsRes.error) throw new Error('Assistants: ' + assistantsRes.error.message);
    // SMS und Leads sind optional – Fehler loggen, aber nicht abbrechen
    if (smsRes.error) console.warn('[Dashboard] SMS-Tabelle nicht verfügbar:', smsRes.error.message);
    if (leadsRes.error) console.warn('[Dashboard] Leads-Tabelle nicht verfügbar:', leadsRes.error.message);

    const calls = callsRes.data || [];
    const assistants = assistantsRes.data || [];
    const sms = smsRes.data || [];
    const leads = leadsRes.data || [];

    // KPIs berechnen
    const totalCalls = calls.length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const callCosts = calls.reduce((sum, c) => sum + parseFloat(c.cost || 0), 0);
    const smsCosts = sms.reduce((sum, s) => sum + parseFloat(s.cost || 0), 0);
    const totalCost = callCosts + smsCosts;

    const inboundCalls = calls.filter(c => c.direction === 'inbound').length;
    const outboundCalls = calls.filter(c => c.direction === 'outbound').length;
    const missedCalls = calls.filter(c => c.status === 'missed').length;
    const completedCalls = calls.filter(c => c.status === 'completed').length;

    const totalAssistants = assistants.length;
    const activeAssistants = assistants.filter(a => a.status === 'active' || a.status === 'online').length;

    return ok({
      calls: {
        total: totalCalls,
        inbound: inboundCalls,
        outbound: outboundCalls,
        missed: missedCalls,
        completed: completedCalls,
      },
      duration: {
        totalSeconds: totalDuration,
        totalFormatted: formatDuration(totalDuration),
        avgSeconds: avgDuration,
        avgFormatted: formatDuration(avgDuration),
      },
      cost: {
        calls: Math.round(callCosts * 100) / 100,
        sms: Math.round(smsCosts * 100) / 100,
        total: Math.round(totalCost * 100) / 100,
      },
      assistants: {
        total: totalAssistants,
        active: activeAssistants,
      },
      sms: {
        total: sms.length,
      },
      leads: {
        total: leads.length,
      },
      period: { from, to },
    });

  } catch (err) {
    console.error('[Dashboard] KPI-Fehler:', err.message);
    return fail('KPIs konnten nicht geladen werden.', err.message);
  }
}


/**
 * getCallStats(options)
 * ---------------------
 * Detaillierte Anruf-Statistiken mit den letzten N Anrufen.
 *
 * @param {Object} options - { limit: 50 }
 * @returns {Object} { success, data }
 */
async function getCallStats(options = {}) {
  const userId = await getCurrentUserId();
  if (!userId) return fail('Nicht eingeloggt.');

  const limit = options.limit || 50;

  try {
    const { data, error } = await getClient()
      .from('calls')
      .select('id, phone_number, direction, status, duration_seconds, cost, transcript, assistant_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const calls = (data || []).map(c => ({
      id: c.id,
      phoneNumber: c.phone_number,
      direction: c.direction,
      status: c.status,
      durationSeconds: c.duration_seconds,
      durationFormatted: formatDuration(c.duration_seconds),
      cost: parseFloat(c.cost || 0),
      hasTranscript: !!c.transcript,
      assistantId: c.assistant_id,
      createdAt: c.created_at,
    }));

    return ok({
      calls,
      count: calls.length,
    });

  } catch (err) {
    console.error('[Dashboard] CallStats-Fehler:', err.message);
    return fail('Anrufe konnten nicht geladen werden.', err.message);
  }
}


/**
 * getUsageOverTime(options)
 * -------------------------
 * Anrufe pro Tag für ein Balkendiagramm.
 *
 * @param {Object} options - { days: 30 }
 * @returns {Object} { success, data }
 */
async function getUsageOverTime(options = {}) {
  const userId = await getCurrentUserId();
  if (!userId) return fail('Nicht eingeloggt.');

  const days = options.days || 30;
  const since = daysAgo(days);

  try {
    const { data, error } = await getClient()
      .from('calls')
      .select('created_at, duration_seconds, cost')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Calls pro Tag gruppieren
    const dailyMap = {};

    // Alle Tage vorinitialisieren (auch Tage ohne Calls)
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
      dailyMap[key] = { date: key, calls: 0, duration: 0, cost: 0 };
    }

    // Echte Daten eintragen
    (data || []).forEach(c => {
      const key = c.created_at.split('T')[0];
      if (dailyMap[key]) {
        dailyMap[key].calls += 1;
        dailyMap[key].duration += (c.duration_seconds || 0);
        dailyMap[key].cost += parseFloat(c.cost || 0);
      }
    });

    const timeline = Object.values(dailyMap).map(d => ({
      date: d.date,
      label: new Date(d.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }),
      calls: d.calls,
      durationSeconds: d.duration,
      durationFormatted: formatDuration(d.duration),
      cost: Math.round(d.cost * 100) / 100,
    }));

    // Peaks berechnen
    const maxCalls = Math.max(...timeline.map(d => d.calls), 0);
    const totalCalls = timeline.reduce((sum, d) => sum + d.calls, 0);
    const avgCallsPerDay = days > 0 ? Math.round((totalCalls / days) * 10) / 10 : 0;

    return ok({
      timeline,
      summary: {
        days,
        totalCalls,
        avgCallsPerDay,
        peakCalls: maxCalls,
        peakDate: timeline.find(d => d.calls === maxCalls)?.date || null,
      },
    });

  } catch (err) {
    console.error('[Dashboard] Usage-Fehler:', err.message);
    return fail('Nutzungsdaten konnten nicht geladen werden.', err.message);
  }
}


/**
 * estimateCosts(options)
 * ----------------------
 * Kostenübersicht: aktueller Monat vs. Vormonat.
 *
 * Kosten-Logik:
 *   - Anrufe:  cost-Feld aus der DB (realer Wert von Telnyx/ElevenLabs)
 *   - Fallback: €0.04/Minute (ElevenLabs Grant Kostenbasis)
 *   - SMS:     cost-Feld aus der DB
 *
 * @returns {Object} { success, data }
 */
async function estimateCosts(options = {}) {
  const userId = await getCurrentUserId();
  if (!userId) return fail('Nicht eingeloggt.');

  const COST_PER_MINUTE_FALLBACK = 0.04; // €0.04/Min mit ElevenLabs Grant

  const now = new Date();
  const thisMonthFrom = startOfMonth(now);
  const thisMonthTo = endOfMonth(now);

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthFrom = startOfMonth(lastMonth);
  const lastMonthTo = endOfMonth(lastMonth);

  try {
    const sb = getClient();

    const [thisRes, lastRes, smsThisRes, smsLastRes] = await Promise.all([
      sb.from('calls').select('duration_seconds, cost').eq('user_id', userId)
        .gte('created_at', thisMonthFrom).lte('created_at', thisMonthTo),

      sb.from('calls').select('duration_seconds, cost').eq('user_id', userId)
        .gte('created_at', lastMonthFrom).lte('created_at', lastMonthTo),

      sb.from('sms_messages').select('cost').eq('user_id', userId)
        .gte('created_at', thisMonthFrom).lte('created_at', thisMonthTo),

      sb.from('sms_messages').select('cost').eq('user_id', userId)
        .gte('created_at', lastMonthFrom).lte('created_at', lastMonthTo),
    ]);

    // Kosten berechnen (mit Fallback wenn cost-Feld leer)
    function calcCallCost(calls) {
      return (calls || []).reduce((sum, c) => {
        const stored = parseFloat(c.cost || 0);
        if (stored > 0) return sum + stored;
        // Fallback: Minutenpreis
        const minutes = (c.duration_seconds || 0) / 60;
        return sum + (minutes * COST_PER_MINUTE_FALLBACK);
      }, 0);
    }

    function calcSmsCost(messages) {
      return (messages || []).reduce((sum, s) => sum + parseFloat(s.cost || 0), 0);
    }

    const thisCallCost = calcCallCost(thisRes.data);
    const lastCallCost = calcCallCost(lastRes.data);
    const thisSmsCost = calcSmsCost(smsThisRes.data);
    const lastSmsCost = calcSmsCost(smsLastRes.data);

    const thisTotal = thisCallCost + thisSmsCost;
    const lastTotal = lastCallCost + lastSmsCost;

    // Veränderung berechnen
    let changePercent = 0;
    let changeTrend = 'neutral';
    if (lastTotal > 0) {
      changePercent = Math.round(((thisTotal - lastTotal) / lastTotal) * 100);
      changeTrend = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral';
    }

    const round = v => Math.round(v * 100) / 100;

    return ok({
      thisMonth: {
        calls: round(thisCallCost),
        sms: round(thisSmsCost),
        total: round(thisTotal),
        callCount: (thisRes.data || []).length,
        smsCount: (smsThisRes.data || []).length,
      },
      lastMonth: {
        calls: round(lastCallCost),
        sms: round(lastSmsCost),
        total: round(lastTotal),
        callCount: (lastRes.data || []).length,
        smsCount: (smsLastRes.data || []).length,
      },
      change: {
        percent: changePercent,
        trend: changeTrend,
        label: changeTrend === 'down'
          ? `↓ ${Math.abs(changePercent)}% vs. Vormonat`
          : changeTrend === 'up'
            ? `↑ ${changePercent}% vs. Vormonat`
            : 'Gleich wie Vormonat',
      },
      costBasis: {
        perMinuteFallback: COST_PER_MINUTE_FALLBACK,
        note: 'Reale Kosten aus DB bevorzugt. Fallback: €0.04/Min (ElevenLabs Grant).',
      },
    });

  } catch (err) {
    console.error('[Dashboard] Kosten-Fehler:', err.message);
    return fail('Kosten konnten nicht berechnet werden.', err.message);
  }
}


/**
 * getAssistants()
 * ---------------
 * Alle Assistenten des Users mit Anrufzahl.
 *
 * @returns {Object} { success, data }
 */
async function getAssistants() {
  const userId = await getCurrentUserId();
  if (!userId) return fail('Nicht eingeloggt.');

  try {
    const { data, error } = await getClient()
      .from('assistants')
      .select('id, name, status, description, call_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const assistants = (data || []).map(a => ({
      id: a.id,
      name: a.name,
      status: a.status,
      description: a.description,
      callCount: a.call_count || 0,
      createdAt: a.created_at,
    }));

    return ok({
      assistants,
      total: assistants.length,
      active: assistants.filter(a => a.status === 'active' || a.status === 'online').length,
    });

  } catch (err) {
    console.error('[Dashboard] Assistenten-Fehler:', err.message);
    return fail('Assistenten konnten nicht geladen werden.', err.message);
  }
}


/**
 * createAssistant(assistantData)
 * ------------------------------
 * Erstellt einen neuen KI-Assistenten.
 *
 * @param {Object} assistantData - { name, description, systemPrompt, voiceId }
 * @returns {Object} { success, data }
 */
async function createAssistant(assistantData = {}) {
  const userId = await getCurrentUserId();
  if (!userId) return fail('Nicht eingeloggt.');

  if (!assistantData.name || assistantData.name.trim().length === 0) {
    return fail('Assistent braucht einen Namen.');
  }

  try {
    const { data, error } = await getClient()
      .from('assistants')
      .insert([{
        user_id: userId,
        name: assistantData.name.trim(),
        system_prompt: assistantData.systemPrompt || null,
        voice: assistantData.voice || null,
        language: assistantData.language || 'de',
        status: 'offline',
      }])
      .select()
      .single();

    if (error) throw error;

    return ok({
      assistant: {
        id: data.id,
        name: data.name,
        status: data.status,
        createdAt: data.created_at,
      },
      message: `Assistent "${data.name}" wurde erstellt.`,
    });

  } catch (err) {
    console.error('[Dashboard] Assistent-Erstellen-Fehler:', err.message);
    return fail('Assistent konnte nicht erstellt werden.', err.message);
  }
}


/**
 * getUserProfile()
 * ----------------
 * User-Profil mit Metadaten und Plan-Info.
 *
 * @returns {Object} { success, data }
 */
async function getUserProfile() {
  const user = await getCurrentUser();
  if (!user) return fail('Nicht eingeloggt.');

  const meta = user.user_metadata || {};

  try {
    // Settings aus DB laden (falls vorhanden)
    const { data: settings } = await getClient()
      .from('user_settings')
      .select('plan, balance, settings')
      .eq('user_id', user.id)
      .single();

    return ok({
      id: user.id,
      email: user.email,
      firstName: meta.firstName || user.email.split('@')[0],
      lastName: meta.lastName || '',
      fullName: meta.fullName || meta.firstName || user.email.split('@')[0],
      company: meta.company || '',
      initials: ((meta.firstName || user.email)[0] + (meta.lastName || '')[0]).toUpperCase().trim() || '?',
      plan: settings?.plan || meta.plan || 'basic',
      balance: settings?.balance || 0,
      createdAt: user.created_at,
    });

  } catch (err) {
    // Wenn user_settings-Tabelle nicht existiert, trotzdem Profil zurückgeben
    return ok({
      id: user.id,
      email: user.email,
      firstName: meta.firstName || user.email.split('@')[0],
      lastName: meta.lastName || '',
      fullName: meta.fullName || meta.firstName || user.email.split('@')[0],
      company: meta.company || '',
      initials: ((meta.firstName || user.email)[0] + (meta.lastName || '')[0]).toUpperCase().trim() || '?',
      plan: meta.plan || 'basic',
      balance: 0,
      createdAt: user.created_at,
    });
  }
}


// ============================================================
// EXPORT: Alles als ein Objekt
// ============================================================
const Dashboard = {
  // Client
  getClient,
  getCurrentUserId,
  getCurrentUser,

  // KPIs
  getKPIs: getDashboardKPIs,
  getCallStats,
  getUsageOverTime,
  estimateCosts,

  // Assistenten
  getAssistants,
  createAssistant,

  // User
  getUserProfile,

  // Hilfsfunktionen
  formatDuration,
};

// Für Browser: global verfügbar machen
if (typeof window !== 'undefined') {
  window.Dashboard = Dashboard;
}

// Für Node.js / ES Modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Dashboard;
}
