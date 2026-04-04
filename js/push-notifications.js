// Push Notifications Manager
// Depends on: supabase-init.js, auth.js
const PushManager = {
  _registration: null,

  async init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      this._registration = await navigator.serviceWorker.ready;
    } catch (e) {
      // Service worker not available
    }
  },

  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  getPermissionState() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission; // 'granted', 'denied', 'default'
  },

  async requestPermission() {
    if (!this.isSupported()) return 'unsupported';
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await this._subscribe();
    }
    return permission;
  },

  async _subscribe() {
    if (!this._registration) return;
    try {
      // Check for existing subscription
      let subscription = await this._registration.pushManager.getSubscription();
      if (subscription) return subscription;

      // Get VAPID public key from app config
      const vapidKey = typeof CONFIG !== 'undefined' ? CONFIG.VAPID_PUBLIC_KEY : null;
      if (!vapidKey) return null;

      subscription = await this._registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this._urlBase64ToUint8Array(vapidKey)
      });

      // Save subscription to Supabase
      const user = await auth.getUser();
      if (user) {
        const subJson = subscription.toJSON();
        await supabaseClient.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh || '',
          auth: subJson.keys?.auth || '',
        }, { onConflict: 'user_id,endpoint' });
      }
      return subscription;
    } catch (err) {
      if (typeof Logger !== 'undefined') Logger.error('PushManager._subscribe', err);
      return null;
    }
  },

  async unsubscribe() {
    if (!this._registration) return;
    try {
      const subscription = await this._registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        // Remove from DB
        const user = await auth.getUser();
        if (user) {
          await supabaseClient.from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);
        }
      }
    } catch (err) {
      if (typeof Logger !== 'undefined') Logger.error('PushManager.unsubscribe', err);
    }
  },

  // Show local notification (when app is in foreground)
  showLocal(title, body, options = {}) {
    if (Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/img/favicon.svg',
      badge: '/img/favicon.svg',
      tag: options.tag || 'clana-notification',
      ...options
    });
    if (options.onclick) n.onclick = options.onclick;
    return n;
  },

  _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }
};

window.PushManager = PushManager;
