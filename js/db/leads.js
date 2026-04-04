// db/leads.js — Leads, Tasks & Notes CRUD operations
// Depends on: supabase-init.js (supabaseClient), auth.js (auth), logger.js (Logger)
const dbLeads = {
  async getLeads(filters = {}) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const buildQuery = (select) => {
        let q = supabaseClient.from('leads').select(select).order('created_at', { ascending: false });
        if (filters.status) q = q.eq('status', filters.status);
        if (filters.assigned_to) q = q.eq('assigned_to', filters.assigned_to);
        if (filters.limit) q = q.limit(filters.limit);
        return q;
      };

      // Try with profile join, fallback to plain select if FK relationship not available
      let { data, error } = await buildQuery('*, profiles:assigned_to(id, first_name, last_name)');
      if (error) {
        Logger.warn('db.getLeads', 'Profile join failed, retrying without join', error.message);
        const retry = await buildQuery('*');
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getLeads', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async getLead(id) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('leads')
        .select('*, notes(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.getLead', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async createLead(leadData) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('leads')
        .insert([leadData])
        .select()
        .single();

      // If insert fails because industry column doesn't exist, retry without it
      if (error && error.message?.includes('industry') && leadData.industry) {
        const { industry, ...rest } = leadData;
        const retry = await supabaseClient.from('leads').insert([rest]).select().single();
        if (retry.error) throw retry.error;
        return { success: true, data: retry.data };
      }

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.createLead', error);
      return { success: false, error: error.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async updateLead(id, updates) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      // If update fails because industry column doesn't exist, retry without it
      if (error && error.message?.includes('industry') && updates.industry) {
        const { industry, ...rest } = updates;
        if (Object.keys(rest).length === 0) return { success: true, data: null };
        const retry = await supabaseClient.from('leads').update(rest).eq('id', id).select().single();
        if (retry.error) throw retry.error;
        return { success: true, data: retry.data };
      }

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.updateLead', error);
      return { success: false, error: error.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async deleteLead(id) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabaseClient
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('db.deleteLead', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  // ====== CRM: Tasks ======

  async getTasks(filters = {}) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabaseClient
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
      if (filters.lead_id) query = query.eq('lead_id', filters.lead_id);
      if (filters.limit) query = query.limit(filters.limit);

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getTasks', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async createTask(taskData) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('tasks')
        .insert([{ created_by: user.id, ...taskData }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.createTask', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async updateTask(id, updates) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.updateTask', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async deleteTask(id) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabaseClient
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('db.deleteTask', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  // ====== CRM: Notes ======

  async createNote(noteData) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('notes')
        .insert([{ author_id: user.id, ...noteData }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.createNote', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async deleteNote(id) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabaseClient
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('db.deleteNote', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  }
};
