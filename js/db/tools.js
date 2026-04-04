// db/tools.js — WorkingHours, TimeOff, TeamAvailability, LeadScoring, EmailTemplates, Onboarding, DuplicateDetection, RealtimeSubscriptions, BulkImport
// Depends on: supabase-init.js (supabaseClient), auth.js (auth), logger.js (Logger)
const dbTools = {
  // ====== Working Hours ======

  async getWorkingHours(userId) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const uid = userId || user.id;
      const { data, error } = await supabaseClient.from('working_hours').select('*').eq('user_id', uid).order('day_of_week');
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getWorkingHours', error);
      return { success: false, error: error.message };
    }
  },

  async setWorkingHours(hoursArray) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      // Delete existing
      await supabaseClient.from('working_hours').delete().eq('user_id', user.id);
      // Insert new
      if (hoursArray.length) {
        const rows = hoursArray.map(h => ({ ...h, user_id: user.id }));
        const { error } = await supabaseClient.from('working_hours').insert(rows);
        if (error) throw error;
      }
      return { success: true };
    } catch (error) {
      Logger.error('db.setWorkingHours', error);
      return { success: false, error: error.message };
    }
  },

  // ====== Time Off / Vacation ======

  async getTimeOffRequests(userId, year) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const uid = userId || user.id;
      let query = supabaseClient.from('time_off_requests').select('*').eq('user_id', uid).order('start_date', { ascending: false });
      if (year) query = query.gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`);
      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getTimeOffRequests', error);
      return { success: false, error: error.message };
    }
  },

  async createTimeOffRequest(data) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      data.user_id = user.id;
      const { data: req, error } = await supabaseClient.from('time_off_requests').insert([data]).select().single();
      if (error) throw error;
      return { success: true, data: req };
    } catch (error) {
      Logger.error('db.createTimeOffRequest', error);
      return { success: false, error: error.message };
    }
  },

  async updateTimeOffStatus(id, status, approvedBy) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const updates = { status };
      if (status === 'approved') { updates.approved_by = approvedBy || user.id; updates.approved_at = new Date().toISOString(); }
      const { data, error } = await supabaseClient.from('time_off_requests').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.updateTimeOffStatus', error);
      return { success: false, error: error.message };
    }
  },

  async getVacationBalance(userId, year) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const uid = userId || user.id;
      const yr = year || new Date().getFullYear();
      // Get quota
      const { data: quota } = await supabaseClient.from('vacation_quotas').select('*').eq('user_id', uid).eq('year', yr).maybeSingle();
      const totalDays = (quota?.total_days || 30) + (quota?.carried_over || 0);
      // Get used
      const { data: requests } = await supabaseClient.from('time_off_requests').select('days_count').eq('user_id', uid).eq('type', 'vacation').eq('status', 'approved').gte('start_date', `${yr}-01-01`).lte('start_date', `${yr}-12-31`);
      const usedDays = (requests || []).reduce((s, r) => s + Number(r.days_count), 0);
      return { success: true, data: { totalDays, usedDays, remaining: totalDays - usedDays } };
    } catch (error) {
      Logger.error('db.getVacationBalance', error);
      return { success: true, data: { totalDays: 30, usedDays: 0, remaining: 30 } };
    }
  },

  // ====== Team Availability (for admins) ======

  async getTeamAvailability(startDate, endDate) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const [timeOff, workHours] = await Promise.all([
        supabaseClient.from('time_off_requests').select('user_id, start_date, end_date, type, status').eq('status', 'approved').gte('end_date', startDate).lte('start_date', endDate),
        supabaseClient.from('working_hours').select('user_id, day_of_week, start_time, end_time, is_active')
      ]);
      return { success: true, timeOff: timeOff.data || [], workHours: workHours.data || [] };
    } catch (error) {
      Logger.error('db.getTeamAvailability', error);
      return { success: false };
    }
  },

  // ====== Lead Scoring ======

  calculateLeadScore(lead) {
    let score = 0;
    const factors = {};

    // Industry (max 20)
    const highValueIndustries = ['handwerk', 'immobilien', 'recht', 'gesundheit'];
    const medValueIndustries = ['auto', 'dienstleistung', 'it'];
    if (highValueIndustries.includes(lead.industry)) { score += 20; factors.industry = 20; }
    else if (medValueIndustries.includes(lead.industry)) { score += 15; factors.industry = 15; }
    else if (lead.industry) { score += 10; factors.industry = 10; }

    // Value (max 30)
    const val = Number(lead.value) || 0;
    if (val >= 5000) { score += 30; factors.value = 30; }
    else if (val >= 2000) { score += 20; factors.value = 20; }
    else if (val >= 500) { score += 10; factors.value = 10; }

    // Completeness (max 20)
    let complete = 0;
    if (lead.email) complete += 5;
    if (lead.phone) complete += 5;
    if (lead.contact_name) complete += 5;
    if (lead.industry) complete += 5;
    score += complete;
    factors.completeness = complete;

    // Activity / Recency (max 30)
    if (lead.updated_at) {
      const daysSince = (Date.now() - new Date(lead.updated_at).getTime()) / 86400000;
      if (daysSince < 3) { score += 30; factors.recency = 30; }
      else if (daysSince < 7) { score += 25; factors.recency = 25; }
      else if (daysSince < 14) { score += 15; factors.recency = 15; }
      else if (daysSince < 30) { score += 5; factors.recency = 5; }
    }

    return { score: Math.min(score, 100), factors };
  },

  async updateLeadScore(leadId, lead) {
    try {
      const { score, factors } = this.calculateLeadScore(lead);
      await supabaseClient.from('leads').update({ score, score_factors: factors }).eq('id', leadId);
      return { success: true, score };
    } catch (error) {
      Logger.error('db.updateLeadScore', error);
      return { success: false };
    }
  },

  // ====== Email Templates ======

  async getEmailTemplates() {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabaseClient.from('email_templates').select('*').order('category');
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getEmailTemplates', error);
      return { success: false, error: error.message };
    }
  },

  // ====== Onboarding ======

  async getOnboardingProgress(userId) {
    try {
      const { data, error } = await supabaseClient.from('onboarding_progress').select('step_key, completed_at').eq('user_id', userId);
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getOnboardingProgress', error);
      return { success: true, data: [] };
    }
  },

  async completeOnboardingStep(userId, stepKey) {
    try {
      await supabaseClient.from('onboarding_progress').upsert({ user_id: userId, step_key: stepKey, completed_at: new Date().toISOString() }, { onConflict: 'user_id,step_key' });
      return { success: true };
    } catch (error) {
      Logger.error('db.completeOnboardingStep', error);
      return { success: false };
    }
  },

  // ====== Duplicate Detection ======

  async checkDuplicate(email) {
    try {
      if (!email) return { success: true, duplicates: [] };
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [leads, customers] = await Promise.all([
        supabaseClient.from('leads').select('id, company_name, status').eq('email', email).limit(3),
        supabaseClient.from('customers').select('id, company_name, status').eq('email', email).limit(3)
      ]);

      const duplicates = [];
      (leads.data || []).forEach(l => duplicates.push({ type: 'lead', ...l }));
      (customers.data || []).forEach(c => duplicates.push({ type: 'customer', ...c }));

      return { success: true, duplicates };
    } catch (error) {
      Logger.error('db.checkDuplicate', error);
      return { success: true, duplicates: [] };
    }
  },

  // ====== Realtime Subscriptions ======

  subscribeTable(table, callback) {
    return supabaseClient
      .channel(`${table}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        callback(payload);
      })
      .subscribe();
  },

  // ====== CRM: Bulk Import ======

  async bulkCreateCustomers(customers) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('customers')
        .insert(customers)
        .select();

      if (error) throw error;
      return { success: true, data: data || [], count: (data || []).length };
    } catch (error) {
      Logger.error('db.bulkCreateCustomers', error);
      return { success: false, error: error.message || 'Fehler beim Import.' };
    }
  }
};
