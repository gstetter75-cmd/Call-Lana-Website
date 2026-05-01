// db/business.js — Business Profile (Betriebsprofil) operations
// Depends on: supabase-init.js (supabaseClient), auth.js (auth), logger.js (Logger)
const dbBusiness = {
  async getBusinessProfile(userId) {
    try {
      const target = userId || (await auth.getEffectiveUserId());
      if (!target) throw new Error('Not authenticated');

      // maybeSingle: a brand-new customer has no row yet — return null without erroring
      const { data, error } = await supabaseClient
        .from('business_profiles')
        .select('*')
        .eq('user_id', target)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data: data || null };
    } catch (error) {
      Logger.error('db.getBusinessProfile', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async upsertBusinessProfile(userId, updates) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const target = userId || (await auth.getEffectiveUserId());
      if (!target) throw new Error('No target user');

      // Cross-user write requires superadmin. Read role from profiles only —
      // never from user_metadata (privilege-escalation vector).
      if (user.id !== target) {
        const { data: callerProfile, error: roleErr } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (roleErr || callerProfile?.role !== 'superadmin') {
          throw new Error('Unauthorized: can only update own business profile');
        }
      }

      // Strip caller-supplied PK and provenance/system-managed fields.
      // user_id is fixed by RLS; source is internal workflow metadata
      // (manual / support / website_extracted) and is not customer-editable;
      // created_at / updated_at are owned by the DB defaults + trigger.
      const {
        user_id:    _u,
        source:     _s,
        created_at: _c,
        updated_at: _up,
        ...safeUpdates
      } = updates || {};

      const { data, error } = await supabaseClient
        .from('business_profiles')
        .upsert({ user_id: target, ...safeUpdates }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.upsertBusinessProfile', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  }
};
