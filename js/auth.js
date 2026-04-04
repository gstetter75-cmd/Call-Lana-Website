// Auth Helper Functions
// Depends on: supabase-init.js (supabaseClient), logger.js (Logger)
const auth = {
  // Fire-and-forget audit log for auth events
  _logAuthEvent(action, userId) {
    try {
      supabaseClient.from('audit_logs').insert({
        user_id: userId || null,
        action: action,
        target_type: 'auth',
        created_at: new Date().toISOString()
      }).then(() => {}).catch(() => {});
    } catch (e) { /* never block auth for audit */ }
  },
  // Fire-and-forget welcome email (works when send-welcome-email edge function is deployed)
  async _sendWelcomeEmail(email, firstName) {
    try {
      await supabaseClient.functions.invoke('send-welcome-email', {
        body: { email, firstName: firstName || '' }
      });
    } catch (e) { /* non-critical: edge function may not be deployed yet */ }
  },

  async signUp(email, password, userData) {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: userData }
      });
      if (error) throw error;
      this._logAuthEvent('signup', data?.user?.id);
      // Fire welcome email (non-blocking, only works when edge function is deployed)
      this._sendWelcomeEmail(email, userData?.firstName).catch(() => {});
      return { success: true, data };
    } catch (error) {
      Logger.error('auth.signUp', error);
      return { success: false, error: error.message || 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.' };
    }
  },

  async signIn(email, password) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      this._logAuthEvent('login', data?.user?.id);
      return { success: true, data };
    } catch (error) {
      Logger.error('auth.signIn', error);
      this._logAuthEvent('login_failed');
      return { success: false, error: error.message || 'Anmeldung fehlgeschlagen. Bitte prüfen Sie Ihre Zugangsdaten.' };
    }
  },

  async signOut() {
    const userId = this._userPromise ? (await this._userPromise)?.id : null;
    this._userPromise = null;
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      this._logAuthEvent('logout', userId);
      return { success: true };
    } catch (error) {
      Logger.error('auth.signOut', error);
      return { success: false, error: error.message || 'Abmeldung fehlgeschlagen.' };
    }
  },

  _userPromise: null,

  async getUser() {
    if (this._userPromise) return this._userPromise;
    this._userPromise = supabaseClient.auth.getUser()
      .then(({ data: { user }, error }) => {
        if (error) throw error;
        return user;
      })
      .catch(err => {
        this._userPromise = null;
        Logger.error('auth.getUser', err);
        return null;
      });
    return this._userPromise;
  },

  async getSession() {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      return session;
    } catch (error) {
      Logger.error('auth.getSession', error);
      return null;
    }
  },

  async updateProfile(updates) {
    try {
      const { data, error } = await supabaseClient.auth.updateUser({
        data: updates
      });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('auth.updateProfile', error);
      return { success: false, error: error.message || 'Profil konnte nicht aktualisiert werden.' };
    }
  },

  // Returns the effective user ID — impersonated customer ID or own ID
  async getEffectiveUserId() {
    if (typeof ImpersonationManager !== 'undefined' && ImpersonationManager.isActive()) {
      return ImpersonationManager.getTargetUserId();
    }
    const user = await this.getUser();
    return user?.id || null;
  },

  async resetPassword(email) {
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password.html'
      });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('auth.resetPassword', error);
      return { success: false, error: error.message || 'Passwort-Zurücksetzung fehlgeschlagen.' };
    }
  }
};

// Auth state change listener — handles cross-tab logout, session expiry
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    // Invalidate cache immediately
    auth._userPromise = null;
    // Only redirect if on a protected page (not login/register/public)
    const protectedPages = ['dashboard.html', 'admin.html', 'sales.html', 'settings.html'];
    const currentPage = window.location.pathname.split('/').pop();
    if (protectedPages.includes(currentPage)) {
      window.location.href = 'login.html';
    }
  } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
    // Invalidate stale cache so next getUser() fetches fresh data
    auth._userPromise = null;
  }
});

window.clanaAuth = auth;
