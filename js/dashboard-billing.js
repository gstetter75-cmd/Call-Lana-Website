// Extracted from dashboard.js — Billing & Balance, Top-Up, Auto-Reload, Hard Cap, Transactions
// ==========================================
// BILLING & BALANCE
// ==========================================
const OVERAGE_RATE_CENTS = 15; // 0,15€ per minute overage

let selectedTopupAmount = 5000; // default 50€

function openTopupModal() {
  document.getElementById('topupModal').style.display = 'flex';
  document.getElementById('customTopup').value = '';
  selectTopup(document.querySelector('.topup-btn.active'));
}

function closeTopupModal() {
  document.getElementById('topupModal').style.display = 'none';
}

function selectTopup(btn) {
  document.querySelectorAll('.topup-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedTopupAmount = parseInt(btn.dataset.amount);
  document.getElementById('customTopup').value = '';
  updateTopupButton();
}

document.getElementById('customTopup')?.addEventListener('input', function() {
  if (this.value) {
    document.querySelectorAll('.topup-btn').forEach(b => b.classList.remove('active'));
    selectedTopupAmount = Math.round(parseFloat(this.value) * 100);
  }
  updateTopupButton();
});

function updateTopupButton() {
  const custom = document.getElementById('customTopup').value;
  const amount = custom ? Math.round(parseFloat(custom) * 100) : selectedTopupAmount;
  document.getElementById('topupConfirmBtn').textContent = formatCents(amount) + ' aufladen';
}

function formatCents(cents) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

async function confirmTopup() {
  const custom = document.getElementById('customTopup').value;
  const amount = custom ? Math.round(parseFloat(custom) * 100) : selectedTopupAmount;

  if (amount < 500) { showToast('Mindestbetrag: 5,00 €', true); return; }
  if (amount > 100000) { showToast('Maximalbetrag: 1.000,00 €', true); return; }

  const btn = document.getElementById('topupConfirmBtn');
  btn.disabled = true;
  btn.textContent = 'Wird geprüft...';

  const user = await clanaAuth.getUser();
  if (!user) { showToast('Nicht angemeldet.', true); btn.disabled = false; updateTopupButton(); return; }

  // BILLING GATE: require an active payment method before allowing topup.
  // Without this check any authenticated user could call atomic_balance_topup
  // directly and credit their balance without a real payment.
  // NOTE: a server-side Stripe charge must gate the RPC before going live.
  try {
    const { data: pms, error: pmErr } = await supabaseClient
      .from('payment_methods')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1);

    if (pmErr) throw pmErr;
    if (!pms || pms.length === 0) {
      showToast('Bitte hinterlege zuerst eine Zahlungsmethode.', true);
      btn.disabled = false;
      updateTopupButton();
      return;
    }
  } catch (err) {
    Logger.error('confirmTopup.pmCheck', err);
    showToast('Zahlungsmethode konnte nicht geprüft werden. Bitte versuche es erneut.', true);
    btn.disabled = false;
    updateTopupButton();
    return;
  }

  btn.textContent = 'Wird aufgeladen...';

  try {
    // Atomic balance topup via PostgreSQL function (prevents race conditions)
    const { data, error } = await supabaseClient.rpc('atomic_balance_topup', {
      p_user_id: currentUser.id,
      p_amount_cents: amount
    });
    if (error) throw error;

    showToast('Guthaben aufgeladen: ' + formatCents(amount));
    closeTopupModal();
    await loadBillingData();
  } catch (err) {
    Logger.error('topupBalance', err);
    showToast('Aufladung fehlgeschlagen. Bitte versuchen Sie es erneut.', true);
  } finally {
    btn.disabled = false;
    updateTopupButton();
  }
}

async function saveAutoReloadSettings() {
  const user = await clanaAuth.getUser();
  if (!user) return;

  const enabled = document.getElementById('autoReloadToggle').checked;
  const threshold = parseInt(document.getElementById('autoReloadThreshold').value);
  const amount = parseInt(document.getElementById('autoReloadAmount').value);

  try {
    await supabaseClient.from('subscriptions').update({
      auto_reload_enabled: enabled,
      auto_reload_threshold_cents: threshold,
      auto_reload_amount_cents: amount
    }).eq('user_id', await auth.getEffectiveUserId());
    showToast(enabled ? 'Auto-Aufladung aktiviert' : 'Auto-Aufladung deaktiviert');
  } catch (err) {
    Logger.error('saveAutoReloadSettings', err);
    showToast('Einstellung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.', true);
  }
}

async function saveHardCapSettings() {
  const user = await clanaAuth.getUser();
  if (!user) return;

  const enabled = document.getElementById('hardCapToggle').checked;
  const amount = parseInt(document.getElementById('hardCapAmount').value);

  try {
    await supabaseClient.from('subscriptions').update({
      hard_cap_enabled: enabled,
      hard_cap_cents: amount
    }).eq('user_id', await auth.getEffectiveUserId());
    showToast(enabled ? 'Ausgabenlimit auf ' + formatCents(amount) + ' gesetzt' : 'Ausgabenlimit deaktiviert');
    await loadBillingData();
  } catch (err) {
    Logger.error('saveHardCapSettings', err);
    showToast('Einstellung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.', true);
  }
}

async function loadBillingData() {
  const user = await clanaAuth.getUser();
  if (!user) return;

  try {
    // Load billing account
    const { data: account } = await supabaseClient
      .from('subscriptions').select('*').eq('user_id', await auth.getEffectiveUserId()).single();

    if (!account) return;

    // Balance
    const balance = account.balance_cents || 0;
    document.getElementById('balanceValue').textContent = formatCents(balance);
    document.getElementById('balanceSub').textContent = balance > 0 ? 'Verfügbar' : 'Kein Guthaben vorhanden';

    // Plan minutes usage (subscriptions table field names)
    const used = Math.round(parseFloat(account.used_minutes) || 0);
    const included = account.included_minutes || 0;
    const overage = Math.round(parseFloat(account.overage_minutes) || 0);
    const percent = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : 0;
    const remaining = Math.max(0, included - used);

    document.getElementById('minutesUsed').textContent = used;
    document.getElementById('minutesIncluded').textContent = included;
    document.getElementById('minutesBar').style.width = percent + '%';
    document.getElementById('minutesBar').style.background =
      percent >= 90 ? 'linear-gradient(90deg, var(--orange), var(--red))' :
      percent >= 70 ? 'linear-gradient(90deg, var(--pu), var(--orange))' :
      'linear-gradient(90deg, var(--pu), var(--cyan))';
    document.getElementById('minutesPercent').textContent = percent + '% verbraucht';
    document.getElementById('minutesRemaining').textContent = remaining + ' Min. übrig';

    // Overage info
    const overageEl = document.getElementById('overageInfo');
    if (overage > 0) {
      overageEl.style.display = 'block';
      document.getElementById('overageMinutes').textContent = overage;
      document.getElementById('overageCost').textContent = formatCents(overage * OVERAGE_RATE_CENTS);
    } else {
      overageEl.style.display = 'none';
    }

    // Monthly spending
    const planCost = account.plan_price_cents || 0;
    const overageCost = overage * OVERAGE_RATE_CENTS;
    const totalSpending = planCost + overageCost;
    const hardCap = account.hard_cap_cents || 30000;
    const spendPercent = Math.min(100, Math.round((totalSpending / hardCap) * 100));

    document.getElementById('monthlySpending').textContent = formatCents(totalSpending);
    document.getElementById('hardCapDisplay').textContent = formatCents(hardCap);
    document.getElementById('spendingBar').style.width = spendPercent + '%';
    document.getElementById('spendingBar').style.background =
      spendPercent >= 90 ? 'linear-gradient(90deg, var(--orange), var(--red))' :
      'linear-gradient(90deg, var(--green), var(--cyan))';
    document.getElementById('spendingPercent').textContent = spendPercent + '% vom Limit';

    // Auto-reload settings
    document.getElementById('autoReloadToggle').checked = account.auto_reload_enabled || false;
    document.getElementById('autoReloadThreshold').value = account.auto_reload_threshold_cents || 500;
    document.getElementById('autoReloadAmount').value = account.auto_reload_amount_cents || 5000;

    // Hard cap settings
    document.getElementById('hardCapToggle').checked = account.hard_cap_enabled !== false;
    document.getElementById('hardCapAmount').value = account.hard_cap_cents || 30000;

    // Usage stats
    document.getElementById('usageCalls').textContent = '–'; // from calls table
    document.getElementById('usageMinutes').textContent = used + overage;
    document.getElementById('usagePlanCost').textContent = formatCents(planCost);
    document.getElementById('usageOverageCost').textContent = formatCents(overageCost);

    // Load transactions
    await loadTransactions();
  } catch (err) {
    Logger.warn('loadBillingData', 'Billing account might not exist yet', err);
  }
}

async function loadTransactions() {
  const user = await clanaAuth.getUser();
  if (!user) return;

  try {
    const { data, error } = await supabaseClient
      .from('billing_transactions')
      .select('*')
      .eq('user_id', await auth.getEffectiveUserId())
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    document.getElementById('txCount').textContent = (data || []).length;

    const typeLabels = {
      plan_charge: 'Tarifgebühr',
      topup: 'Aufladung',
      auto_reload: 'Auto-Aufladung',
      usage_charge: 'Verbrauch',
      refund: 'Erstattung',
      credit: 'Gutschrift'
    };

    const tbody = document.getElementById('txTableBody');
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--tx3);padding:30px;">Keine Transaktionen vorhanden</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(tx => {
      const isPositive = ['topup', 'auto_reload', 'refund', 'credit'].includes(tx.type);
      const amountColor = isPositive ? 'var(--green)' : 'var(--tx2)';
      const prefix = isPositive ? '+' : '-';
      return `<tr>
        <td>${new Date(tx.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
        <td><span class="status-badge ${isPositive ? 'completed' : 'active'}">${typeLabels[tx.type] || tx.type}</span></td>
        <td>${escHtml(tx.description || '–')}</td>
        <td style="font-weight:700;color:${amountColor};">${prefix}${formatCents(Math.abs(tx.amount_cents))}</td>
        <td style="color:var(--tx3);">${tx.balance_after_cents != null ? formatCents(tx.balance_after_cents) : '–'}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    Logger.warn('loadTransactions', 'Table might not exist yet', err);
  }
}
