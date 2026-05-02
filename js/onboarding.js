// ==========================================
// Onboarding Checklist for Customer Dashboard
// Depends on: db.js, dashboard-components.js
// ==========================================

const Onboarding = {
  steps: [
    { key: 'business_profile', label: 'Betriebsprofil ausfüllen', desc: 'Gewerk, Leistungen und Einsatzgebiet erfassen', icon: '🏠', page: 'business' },
    { key: 'create_assistant', label: 'KI-Assistenten erstellen', desc: 'Erstelle deinen ersten Telefon-Assistenten', icon: '🤖', page: 'assistants' },
    { key: 'assign_number', label: 'Telefonnummer zuweisen', desc: 'Weise deinem Assistenten eine Nummer zu', icon: '📞', page: 'phones' },
    { key: 'configure_greeting', label: 'Begrüßung konfigurieren', desc: 'Passe die Begrüßung deines Assistenten an', icon: '👋', page: 'assistants' },
    { key: 'first_test_call', label: 'Testanruf durchführen', desc: 'Rufe deine Nummer an und teste den Assistenten', icon: '✅', page: 'transactions' }
  ],

  container: null,
  completedSteps: new Set(),

  async init(userId) {
    this.userId = userId;
    this.container = document.getElementById('onboarding-section');
    if (!this.container) return;

    // Load progress — treat any failure as empty (table may not exist yet)
    let completed = [];
    try {
      const result = await clanaDB.getOnboardingProgress(userId);
      completed = result?.data || [];
    } catch(e) {
      // continue with empty progress
    }
    this.completedSteps = new Set(completed.map(c => c.step_key));

    // Auto-detect completed steps — non-fatal if it fails
    try {
      await this.autoDetect();
    } catch(e) {
      // proceed with whatever progress we have
    }

    // Don't show if all steps done
    if (this.completedSteps.size >= this.steps.length) {
      this.container.style.display = 'none';
      return;
    }

    this.render();
  },

  async autoDetect() {
    // Check if Betriebsprofil is filled in (same minimal completeness rule the
    // dashboard uses to decide the first-run redirect to #business).
    if (!this.completedSteps.has('business_profile')) {
      try {
        const result = await clanaDB.getBusinessProfile();
        const ok = !!(result && result.success);
        const checker = window.isBusinessProfileComplete;
        if (ok && typeof checker === 'function' && checker(result.data)) {
          this.completedSteps.add('business_profile');
          clanaDB.completeOnboardingStep(this.userId, 'business_profile');
        }
      } catch (e) {
        // Non-fatal: leave step as pending if the read fails.
      }
    }

    // Check if assistant exists → step "create_assistant" done
    if (!this.completedSteps.has('create_assistant')) {
      const result = await clanaDB.getAssistants();
      if (result.data?.length > 0) {
        this.completedSteps.add('create_assistant');
        clanaDB.completeOnboardingStep(this.userId, 'create_assistant');
      }
    }
  },

  render() {
    const total = this.steps.length;
    const done = this.completedSteps.size;
    const pct = Math.round((done / total) * 100);

    this.container.innerHTML = `
      <div class="card" style="margin-bottom:20px;position:relative;">
        <button onclick="document.getElementById('onboarding-section').style.display='none'" style="position:absolute;top:12px;right:12px;background:none;border:none;color:var(--tx3);cursor:pointer;font-size:16px;" title="Ausblenden">&times;</button>
        <div style="margin-bottom:14px;">
          <h3 style="margin:0 0 4px;font-size:16px;">Willkommen bei Call Lana! 🎉</h3>
          <p style="margin:0;font-size:13px;color:var(--tx3);">Schließe diese Schritte ab, um deinen KI-Assistenten einzurichten.</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <div style="flex:1;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:var(--pu);border-radius:4px;transition:width .5s;"></div>
          </div>
          <span style="font-size:12px;font-weight:700;color:var(--tx3);">${done}/${total}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${this.steps.map(s => {
            const isDone = this.completedSteps.has(s.key);
            return `<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:10px;background:${isDone ? 'var(--bg3)' : 'transparent'};cursor:${isDone ? 'default' : 'pointer'};opacity:${isDone ? '0.6' : '1'};" ${!isDone ? `onclick="if(typeof navigateToPage==='function')navigateToPage('${s.page}')"` : ''}>
              <span style="font-size:20px;">${isDone ? '✅' : s.icon}</span>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:600;${isDone ? 'text-decoration:line-through;' : ''}">${s.label}</div>
                <div style="font-size:11px;color:var(--tx3);">${s.desc}</div>
              </div>
              ${!isDone ? '<span style="font-size:12px;color:var(--pu);">→</span>' : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
    this.container.style.display = 'block';
  }
};

window.Onboarding = Onboarding;
