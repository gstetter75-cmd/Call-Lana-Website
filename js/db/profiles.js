// db/profiles.js — Profiles, Organizations & OrgMembers operations
// Depends on: supabase-init.js (supabaseClient), auth.js (auth), logger.js (Logger)
const dbProfiles = {
  async getProfile(userId) {
    try {
      const user = userId || (await auth.getUser())?.id;
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*, organizations(name, plan)')
        .eq('id', user)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.getProfile', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async updateProfile(userId, updates) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (user.id !== userId && user.user_metadata?.role !== 'superadmin') {
        throw new Error('Unauthorized: can only update own profile');
      }

      const { data, error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.updateProfile', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async getAllProfiles(filters = {}) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabaseClient
        .from('profiles')
        .select('*, organizations(name, plan)')
        .order('created_at', { ascending: false });

      if (filters.role) query = query.eq('role', filters.role);
      if (filters.organization_id) query = query.eq('organization_id', filters.organization_id);
      if (filters.limit) query = query.limit(filters.limit);

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getAllProfiles', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  // ====== Organizations CRUD ======

  async getOrganizations() {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('organizations')
        .select('*, profiles!organizations_owner_id_fkey(first_name, last_name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getOrganizations', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async getOrganization(id) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('organizations')
        .select('*, organization_members(*, profiles(first_name, last_name, email, role))')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.getOrganization', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async createOrganization(orgData) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('organizations')
        .insert([orgData])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.createOrganization', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async updateOrganization(id, updates) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.updateOrganization', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  // ====== Organization Members ======

  async addOrgMember(orgId, userId, roleInOrg = 'member') {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('organization_members')
        .insert([{ organization_id: orgId, user_id: userId, role_in_org: roleInOrg }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.addOrgMember', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async removeOrgMember(orgId, userId) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabaseClient
        .from('organization_members')
        .delete()
        .eq('organization_id', orgId)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('db.removeOrgMember', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  }
};
