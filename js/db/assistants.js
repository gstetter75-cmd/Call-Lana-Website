// db/assistants.js — Assistants CRUD operations
// Depends on: supabase-init.js (supabaseClient), auth.js (auth), logger.js (Logger)
const dbAssistants = {
  async getAssistants() {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('assistants')
        .select('*')
        .eq('user_id', await auth.getEffectiveUserId())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getAssistants', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async getAllAssistants() {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('assistants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getAllAssistants', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten.' };
    }
  },

  async getAssistant(id) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('assistants')
        .select('*')
        .eq('id', id)
        .eq('user_id', await auth.getEffectiveUserId())
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.getAssistant', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async createAssistant(assistantData) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('assistants')
        .insert([{ user_id: await auth.getEffectiveUserId(), ...assistantData }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.createAssistant', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async updateAssistant(id, updates) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('assistants')
        .update(updates)
        .eq('id', id)
        .eq('user_id', await auth.getEffectiveUserId())
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.updateAssistant', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async deleteAssistant(id) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabaseClient
        .from('assistants')
        .delete()
        .eq('id', id)
        .eq('user_id', await auth.getEffectiveUserId());

      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('db.deleteAssistant', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  }
};
