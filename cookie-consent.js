// ==========================================
// Call Lana – Cookie Consent (DSGVO)
// ==========================================

(function() {
  const COOKIE_KEY = 'calllana_cookie_consent';

  // Check if already consented
  if (localStorage.getItem(COOKIE_KEY)) return;

  // Detect theme: dashboard pages use dark common.css, marketing pages use light theme
  const isDark = document.querySelector('link[href*="common.css"]') !== null;

  // Create banner
  const banner = document.createElement('div');
  banner.id = 'cookieBanner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie-Einstellungen');
  banner.innerHTML = `
    <div class="cb-content">
      <p class="cb-text">Wir verwenden Cookies, um dir die bestmögliche Erfahrung zu bieten. Weitere Informationen findest du in unserer <a href="datenschutz.html">Datenschutzerklärung</a>.</p>
      <div class="cb-actions">
        <button class="cb-btn cb-accept" id="cbAccept">Alle akzeptieren</button>
        <button class="cb-btn cb-essential" id="cbEssential">Nur notwendige</button>
      </div>
    </div>
  `;

  // Styles based on theme
  const style = document.createElement('style');
  if (isDark) {
    style.textContent = `
      #cookieBanner{position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(6,6,15,.97);border-top:1px solid rgba(124,58,237,.25);padding:20px 6%;backdrop-filter:blur(16px);animation:cbSlide .4s ease;}
      @keyframes cbSlide{from{transform:translateY(100%);}to{transform:translateY(0);}}
      .cb-content{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:24px;flex-wrap:wrap;}
      .cb-text{flex:1;min-width:280px;font-size:14px;color:#a89dc0;line-height:1.6;}
      .cb-text a{color:#c084fc;text-decoration:none;}.cb-text a:hover{text-decoration:underline;}
      .cb-actions{display:flex;gap:10px;flex-shrink:0;}
      .cb-btn{border:none;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .2s;}
      .cb-accept{background:linear-gradient(135deg,#7c3aed,#9d5cf6);color:white;box-shadow:0 0 16px rgba(124,58,237,.3);}
      .cb-accept:hover{box-shadow:0 0 28px rgba(124,58,237,.5);transform:translateY(-1px);}
      .cb-essential{background:rgba(255,255,255,.06);color:#f0eeff;border:1px solid rgba(255,255,255,.12);}
      .cb-essential:hover{background:rgba(255,255,255,.1);}
      @media(max-width:600px){.cb-content{flex-direction:column;text-align:center;}.cb-actions{width:100%;justify-content:center;}}
    `;
  } else {
    style.textContent = `
      #cookieBanner{position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(255,255,255,.97);border-top:1px solid #e5e7eb;padding:20px 5%;backdrop-filter:blur(16px);box-shadow:0 -4px 12px rgba(0,0,0,.08);animation:cbSlide .4s ease;}
      @keyframes cbSlide{from{transform:translateY(100%);}to{transform:translateY(0);}}
      .cb-content{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:24px;flex-wrap:wrap;}
      .cb-text{flex:1;min-width:280px;font-size:14px;color:#4b5563;line-height:1.6;}
      .cb-text a{color:#7c3aed;text-decoration:none;font-weight:600;}.cb-text a:hover{text-decoration:underline;}
      .cb-actions{display:flex;gap:10px;flex-shrink:0;}
      .cb-btn{border:none;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .2s;}
      .cb-accept{background:#7c3aed;color:white;box-shadow:0 2px 8px rgba(124,58,237,.3);}
      .cb-accept:hover{background:#6d28d9;box-shadow:0 4px 14px rgba(124,58,237,.4);transform:translateY(-1px);}
      .cb-essential{background:#f3f4f6;color:#111827;border:1.5px solid #d1d5db;}
      .cb-essential:hover{background:#e5e7eb;}
      @media(max-width:600px){.cb-content{flex-direction:column;text-align:center;}.cb-actions{width:100%;justify-content:center;}}
    `;
  }

  document.head.appendChild(style);
  document.body.appendChild(banner);

  document.getElementById('cbAccept').addEventListener('click', function() {
    localStorage.setItem(COOKIE_KEY, 'all');
    banner.remove();
  });

  document.getElementById('cbEssential').addEventListener('click', function() {
    localStorage.setItem(COOKIE_KEY, 'essential');
    banner.remove();
  });
})();
