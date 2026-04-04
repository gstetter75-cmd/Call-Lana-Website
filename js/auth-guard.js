// Auth Guard - Role-based access control and redirects
const AuthGuard = {
  ROLES: { SUPERADMIN: 'superadmin', SALES: 'sales', CUSTOMER: 'customer' },

  ROLE_PAGES: {
    superadmin: ['admin.html', 'dashboard.html', 'sales.html', 'settings.html'],
    sales: ['sales.html', 'settings.html'],
    customer: ['dashboard.html', 'settings.html']
  },

  ROLE_HOME: {
    superadmin: 'admin.html',
    sales: 'sales.html',
    customer: 'dashboard.html'
  },

  async init() {
    // Use getUser() for server-side token verification (not cached getSession)
    const user = await window.clanaAuth.getUser();
    if (!user) {
      // Token invalid or expired — clear stale session to prevent redirect loop
      await window.clanaAuth.signOut();
      window.location.href = 'login.html';
      return null;
    }
    const profile = await this.getProfile();
    if (!profile) {
      // Session valid but profile fetch failed — SECURITY: never trust user_metadata for role
      // Always default to 'customer' (least privilege) to prevent privilege escalation
      Logger.warn('AuthGuard.init', 'Profile fetch failed, using least-privilege fallback');
      this._revealContent();
      return {
        id: user.id,
        email: user.email,
        role: 'customer',
        first_name: '',
        last_name: '',
        organizations: null
      };
    }
    this._revealContent();
    return profile;
  },

  async getProfile() {
    try {
      const user = await window.clanaAuth.getUser();
      if (!user) return null;

      // First try with organization join
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*, organizations(name, plan)')
        .eq('id', user.id)
        .single();

      if (error) {
        // Fallback: try without organization join
        const { data: profileOnly, error: profileError } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;
        return { ...profileOnly, organizations: null };
      }
      return data;
    } catch (err) {
      Logger.error('AuthGuard.getProfile', err);
      return null;
    }
  },

  _revealContent() {
    document.body.classList.remove('auth-pending');
  },

  async requireRole(allowedRoles) {
    const profile = await this.init();
    if (!profile) return null;

    if (!profile.role || !allowedRoles.includes(profile.role)) {
      const home = this.ROLE_HOME[profile.role] || 'login.html';
      window.location.href = home;
      return null;
    }
    this._revealContent();
    return profile;
  },

  async requireSuperadmin() {
    return this.requireRole([this.ROLES.SUPERADMIN]);
  },

  async requireSales() {
    return this.requireRole([this.ROLES.SUPERADMIN, this.ROLES.SALES]);
  },

  async requireCustomer() {
    return this.requireRole([this.ROLES.SUPERADMIN, this.ROLES.CUSTOMER]);
  },

  isSuperadmin(profile) {
    return profile && profile.role === this.ROLES.SUPERADMIN;
  },

  isSales(profile) {
    return profile && profile.role === this.ROLES.SALES;
  },

  isCustomer(profile) {
    return profile && profile.role === this.ROLES.CUSTOMER;
  },

  getDisplayName(profile) {
    if (!profile) return 'User';
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return profile.first_name || profile.email || 'User';
  },

  getInitials(profile) {
    if (!profile) return '?';
    const first = (profile.first_name || '')[0] || '';
    const last = (profile.last_name || '')[0] || '';
    return (first + last).toUpperCase() || '?';
  },

  getHomeUrl(profileOrRole) {
    const role = typeof profileOrRole === 'string' ? profileOrRole : (profileOrRole?.role || 'customer');
    return this.ROLE_HOME[role] || 'dashboard.html';
  }
};

window.AuthGuard = AuthGuard;
