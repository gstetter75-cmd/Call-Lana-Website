// ==========================================
// Admin Impersonation: "Als Kunde einloggen"
// Allows superadmin to view/modify a customer's dashboard
// State stored in sessionStorage (dies with tab close)
// Depends on: supabase-init.js, auth.js, auth-guard.js
// ==========================================

const ImpersonationManager = {

  STORAGE_KEY: 'clana_impersonation',
  TIMEOUT_MS: 60 * 60 * 1000, // 60 minutes
  _timeoutTimer: null,

  // ==========================================
  // STATE
  // ==========================================

  isActive() {
    return !!this._getState();
  },

  getTargetUserId() {
    const state = this._getState();
    return state ? state.targetUserId : null;
  },

  getTargetProfile() {
    const state = this._getState();
    return state ? state.targetProfile : null;
  },

  getAdminProfile() {
    const state = this._getState();
    return state ? state.adminProfile : null;
  },

  // ==========================================
  // START IMPERSONATION
  // ==========================================

  async start(customerId) {
    // Security: only superadmin can impersonate
    const adminUser = await auth.getUser();
    if (!adminUser) return false;

    const adminProfile = await AuthGuard.getProfile();
    if (!adminProfile || adminProfile.role !== 'superadmin') {
      if (typeof showToast !== 'undefined') showToast('Nur Superadmins können sich als Kunde anmelden.', true);
      return false;
    }

    // Load target customer profile
    try {
      const { data: targetProfile, error } = await supabaseClient
        .from('profiles')
        .select('id,email,first_name,last_name,company,plan,role')
        .eq('id', customerId)
        .single();

      if (error || !targetProfile) {
        if (typeof showToast !== 'undefined') showToast('Kunde nicht gefunden.', true);
        return false;
      }

      // Save state to sessionStorage
      const state = {
        targetUserId: customerId,
        targetProfile: targetProfile,
        adminProfile: {
          id: adminProfile.id,
          email: adminProfile.email,
          first_name: adminProfile.first_name,
          last_name: adminProfile.last_name
        },
        startedAt: Date.now()
      };
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));

      // Audit log + start timeout
      this._logAction('start', customerId);
      this.checkTimeout();

      // Redirect to customer dashboard
      window.location.href = 'dashboard.html';
      return true;
    } catch (err) {
      if (typeof Logger !== 'undefined') Logger.error('ImpersonationManager.start', err);
      if (typeof showToast !== 'undefined') showToast('Fehler beim Starten der Impersonation.', true);
      return false;
    }
  },

  // ==========================================
  // STOP IMPERSONATION
  // ==========================================

  stop() {
    const targetId = this.getTargetUserId();
    if (targetId) {
      this._logAction('stop', targetId);
    }
    sessionStorage.removeItem(this.STORAGE_KEY);
    clearTimeout(this._timeoutTimer);
    window.location.href = 'admin.html';
  },

  // ==========================================
  // TIMEOUT CHECK
  // ==========================================

  checkTimeout() {
    const state = this._getState();
    if (!state) return;

    const elapsed = Date.now() - state.startedAt;
    if (elapsed >= this.TIMEOUT_MS) {
      if (typeof showToast !== 'undefined') showToast('Impersonation-Session abgelaufen.');
      this.stop();
      return;
    }

    // Set timer for remaining time
    const remaining = this.TIMEOUT_MS - elapsed;
    clearTimeout(this._timeoutTimer);
    this._timeoutTimer = setTimeout(() => {
      if (typeof showToast !== 'undefined') showToast('Impersonation-Session abgelaufen.');
      this.stop();
    }, remaining);
  },

  // ==========================================
  // RESTRICTED ACTIONS
  // ==========================================

  isActionBlocked(action) {
    if (!this.isActive()) return false;
    const blocked = ['change_password', 'delete_account', 'modify_payment'];
    return blocked.includes(action);
  },

  // ==========================================
  // INTERNAL
  // ==========================================

  _getState() {
    try {
      const raw = sessionStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  _logAction(action, targetUserId) {
    try {
      auth.getUser().then(user => {
        if (!user) return;
        supabaseClient.from('admin_impersonation_log').insert({
          admin_user_id: user.id,
          target_user_id: targetUserId,
          action: action,
          details: { page: window.location.pathname }
        }).then(() => {}).catch(() => {});
      });
    } catch (e) { /* never block for audit */ }
  }
};

window.ImpersonationManager = ImpersonationManager;
