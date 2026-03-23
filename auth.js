// Auth Helper Functions
// Depends on: supabase-init.js (supabaseClient), logger.js (Logger)
const auth = {
  async signUp(email, password, userData) {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: userData }
      });
      if (error) throw error;
      // If email confirmation is disabled, a session is returned immediately.
      // Insert the profile row now so dashboard can load without a DB trigger.
      if (data.session) {
        await this.createProfile(data.session.user, userData);
      }
      return { success: true, data };
    } catch (error) {
      Logger.error('auth.signUp', error);
      return { success: false, error: 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.' };
    }
  },

  async createProfile(user, metadata = {}) {
    try {
      const { error } = await supabaseClient.from('profiles').insert({
        id: user.id,
        email: user.email,
        first_name: metadata.firstName || null,
        last_name: metadata.lastName || null,
        company: metadata.company || null,
        industry: metadata.industry || null,
      });
      // 23505 = unique_violation: profile already exists, safe to ignore
      if (error && error.code !== '23505') {
        Logger.error('auth.createProfile', error);
      }
    } catch (error) {
      Logger.error('auth.createProfile', error);
    }
  },

  async signIn(email, password) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('auth.signIn', error);
      return { success: false, error: 'Anmeldung fehlgeschlagen. Bitte pruefen Sie Ihre Zugangsdaten.' };
    }
  },

  async signOut() {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('auth.signOut', error);
      return { success: false, error: 'Abmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.' };
    }
  },

  async getUser() {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      Logger.error('auth.getUser', error);
      return null;
    }
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
      return { success: false, error: 'Profil konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.' };
    }
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
      return { success: false, error: 'Passwort-Zuruecksetzung fehlgeschlagen. Bitte versuchen Sie es erneut.' };
    }
  }
};

window.clanaAuth = auth;
