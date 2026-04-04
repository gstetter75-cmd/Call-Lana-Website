// db/calls.js — Call & Settings operations
// Depends on: supabase-init.js (supabaseClient), auth.js (auth), logger.js (Logger)
const dbCalls = {
  async saveCall(callData) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const effectiveId = await auth.getEffectiveUserId();

      const { data, error } = await supabaseClient
        .from('calls')
        .insert([{
          user_id: effectiveId,
          phone_number: callData.phoneNumber,
          duration: callData.duration,
          status: callData.status,
          transcript: callData.transcript,
          created_at: callData.timestamp || new Date().toISOString()
        }]);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.saveCall', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async getCalls(limit = 50) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const effectiveId = await auth.getEffectiveUserId();

      const { data, error } = await supabaseClient
        .from('calls')
        .select('*')
        .eq('user_id', effectiveId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.getCalls', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async getStats(startDate, endDate) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const effectiveId = await auth.getEffectiveUserId();

      const { data, error } = await supabaseClient
        .from('calls')
        .select('*')
        .eq('user_id', effectiveId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const totalCalls = data.length;
      const totalDuration = data.reduce((sum, call) => sum + (call.duration || 0), 0);
      const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
      const statuses = data.reduce((acc, call) => {
        acc[call.status] = (acc[call.status] || 0) + 1;
        return acc;
      }, {});

      return {
        success: true,
        stats: { totalCalls, totalDuration, avgDuration, statuses }
      };
    } catch (error) {
      Logger.error('db.getStats', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async saveSettings(settings) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const effectiveId = await auth.getEffectiveUserId();

      const { data, error } = await supabaseClient
        .from('user_settings')
        .upsert([{
          user_id: effectiveId,
          settings: settings,
          updated_at: new Date().toISOString()
        }]);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.saveSettings', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async getSettings() {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const effectiveId = await auth.getEffectiveUserId();

      const { data, error } = await supabaseClient
        .from('user_settings')
        .select('settings')
        .eq('user_id', effectiveId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return { success: true, data: data?.settings || {} };
    } catch (error) {
      Logger.error('db.getSettings', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  }
};
