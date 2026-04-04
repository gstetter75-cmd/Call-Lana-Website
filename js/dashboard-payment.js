// Extracted from dashboard.js — Payment Methods CRUD, IBAN Validation, Card Detection
// ==========================================
// PAYMENT METHODS
// ==========================================
let currentPmPriority = 1;
let currentPmType = 'sepa';

function selectPaymentType(type) {
  currentPmType = type;
  document.querySelectorAll('.pm-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  document.getElementById('formSepa').style.display = type === 'sepa' ? 'block' : 'none';
  document.getElementById('formCard').style.display = type === 'credit_card' ? 'block' : 'none';
  document.getElementById('formPaypal').style.display = type === 'paypal' ? 'block' : 'none';
}

function openPaymentModal(priority) {
  currentPmPriority = priority;
  document.getElementById('pmModalTitle').textContent =
    priority === 1 ? 'Primäre Zahlungsmethode' : 'Ersatz-Zahlungsmethode';
  // Reset forms
  document.querySelectorAll('#paymentModal input').forEach(i => { i.value = ''; if (i.type === 'checkbox') i.checked = false; });
  selectPaymentType('sepa');
  document.getElementById('ibanHint').textContent = '';
  document.getElementById('paymentModal').style.display = 'flex';
}

function closePaymentModal() {
  document.getElementById('paymentModal').style.display = 'none';
}

// IBAN formatting and validation
document.getElementById('sepaIban')?.addEventListener('input', function() {
  let v = this.value.replace(/\s/g, '').toUpperCase();
  // Format with spaces every 4 chars
  this.value = v.replace(/(.{4})/g, '$1 ').trim();

  const hint = document.getElementById('ibanHint');
  if (v.length >= 2) {
    const country = v.substring(0, 2);
    const countries = { DE: 'Deutschland (22 Zeichen)', AT: 'Österreich (20 Zeichen)', CH: 'Schweiz (21 Zeichen)', LU: 'Luxemburg (20 Zeichen)', NL: 'Niederlande (18 Zeichen)' };
    hint.textContent = countries[country] || '';
    hint.style.color = 'var(--tx3)';
  } else {
    hint.textContent = '';
  }
});

// Card number formatting
document.getElementById('cardNumber')?.addEventListener('input', function() {
  let v = this.value.replace(/\D/g, '').substring(0, 16);
  this.value = v.replace(/(.{4})/g, '$1 ').trim();
});

// Card expiry formatting
document.getElementById('cardExpiry')?.addEventListener('input', function() {
  let v = this.value.replace(/\D/g, '').substring(0, 4);
  if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
  this.value = v;
});

function validateIban(iban) {
  const clean = iban.replace(/\s/g, '');
  if (clean.length < 15 || clean.length > 34) return false;
  if (!/^[A-Z]{2}\d{2}/.test(clean)) return false;
  // Basic checksum: move first 4 chars to end, convert letters to numbers
  const rearranged = clean.substring(4) + clean.substring(0, 4);
  const numStr = rearranged.replace(/[A-Z]/g, c => (c.charCodeAt(0) - 55).toString());
  // Modulo 97 check
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numStr[i])) % 97;
  }
  return remainder === 1;
}

async function savePaymentMethod() {
  const btn = document.getElementById('pmSaveBtn');
  const user = await clanaAuth.getUser();
  if (!user) { showToast('Nicht angemeldet.', true); return; }

  // SECURITY: Raw financial data (IBAN, card numbers, CVC) is NEVER stored in our database.
  // All payment data is tokenized via Stripe. Only masked display data is kept.
  const displayData = { user_id: await auth.getEffectiveUserId(), type: currentPmType, priority: currentPmPriority, status: 'pending' };
  let stripePayload = {};

  if (currentPmType === 'sepa') {
    const holder = document.getElementById('sepaHolder').value.trim();
    const iban = document.getElementById('sepaIban').value.replace(/\s/g, '').toUpperCase();
    const consent = document.getElementById('sepaConsent').checked;

    if (!holder) { showToast('Bitte Kontoinhaber eingeben.', true); return; }
    if (!validateIban(iban)) { showToast('Ungültige IBAN. Bitte prüfe die Eingabe.', true); return; }
    if (!consent) { showToast('Bitte bestätige das SEPA-Lastschriftmandat.', true); return; }

    displayData.account_holder = holder;
    displayData.iban_last4 = iban.slice(-4);
    displayData.mandate_reference = 'CLANA-' + Date.now().toString(36).toUpperCase();
    displayData.mandate_date = new Date().toISOString();
    displayData.mandate_confirmed = true;
    stripePayload = { type: 'sepa_debit', iban, holder };

  } else if (currentPmType === 'credit_card') {
    const holder = document.getElementById('cardHolder').value.trim();
    const number = document.getElementById('cardNumber').value.replace(/\s/g, '');
    const expiry = document.getElementById('cardExpiry').value.trim();
    const cvc = document.getElementById('cardCvc').value.trim();

    if (!holder) { showToast('Bitte Karteninhaber eingeben.', true); return; }
    if (number.length < 13 || number.length > 19) { showToast('Ungültige Kartennummer.', true); return; }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) { showToast('Ungültiges Ablaufdatum (MM/YY).', true); return; }
    if (cvc.length < 3) { showToast('Ungültiger CVC.', true); return; }

    displayData.account_holder = holder;
    displayData.card_last4 = number.slice(-4);
    displayData.card_brand = detectCardBrand(number);
    stripePayload = { type: 'card', number, expiry, cvc, holder };

  } else if (currentPmType === 'paypal') {
    stripePayload = { type: 'paypal' };
    displayData.account_holder = 'PayPal';
  }

  btn.disabled = true;
  btn.textContent = 'Wird gespeichert...';

  try {
    // Step 1: Tokenize via Stripe Edge Function (raw card/IBAN data never touches our DB)
    const { data: stripeResult, error: stripeError } = await supabaseClient.functions.invoke('create-payment-method', {
      body: stripePayload
    });

    if (stripeError) throw new Error('Stripe-Verbindung fehlgeschlagen: ' + (stripeError.message || 'Bitte später erneut versuchen.'));

    displayData.stripe_customer_id = stripeResult?.customer_id || null;
    displayData.stripe_payment_method_id = stripeResult?.payment_method_id || null;
    displayData.status = stripeResult?.payment_method_id ? 'active' : 'pending';

    // Step 2: Save ONLY masked display data + Stripe references to DB
    // UPSERT avoids the race condition where DELETE succeeds but INSERT fails
    const { error } = await supabaseClient.from('payment_methods').upsert([displayData], { onConflict: 'user_id,priority' });
    if (error) throw error;

    showToast('Zahlungsmethode gespeichert!');
    closePaymentModal();
    await loadPaymentMethods();
  } catch (err) {
    Logger.error('savePaymentMethod', err);
    showToast(err.message || 'Zahlungsmethode konnte nicht gespeichert werden.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Zahlungsmethode speichern';
  }
}

async function removePaymentMethod(priority) {
  if (!confirm('Zahlungsmethode wirklich entfernen?')) return;
  const user = await clanaAuth.getUser();
  if (!user) return;

  try {
    const { error } = await supabaseClient.from('payment_methods').delete().eq('user_id', await auth.getEffectiveUserId()).eq('priority', priority);
    if (error) throw error;
    showToast('Zahlungsmethode entfernt.');
    await loadPaymentMethods();
  } catch (err) {
    Logger.error('removePaymentMethod', err);
    showToast('Zahlungsmethode konnte nicht entfernt werden. Bitte versuchen Sie es erneut.', true);
  }
}

async function loadPaymentMethods() {
  const user = await clanaAuth.getUser();
  if (!user) return;

  try {
    const { data, error } = await supabaseClient.from('payment_methods').select('*').eq('user_id', await auth.getEffectiveUserId()).order('priority');
    if (error) throw error;

    [1, 2].forEach(p => {
      const pm = (data || []).find(m => m.priority === p);
      const empty = document.getElementById('pm' + p + 'Empty');
      const card = document.getElementById('pm' + p + 'Card');
      const badge = document.getElementById('pm' + p + 'Badge');

      if (pm) {
        empty.style.display = 'none';
        card.style.display = 'block';
        badge.textContent = pm.status === 'active' ? 'Aktiv' : pm.status;

        const typeLabels = { sepa: 'SEPA-Lastschrift', credit_card: 'Kreditkarte', paypal: 'PayPal' };
        document.getElementById('pm' + p + 'Type').textContent = typeLabels[pm.type] || pm.type;

        const statusEl = document.getElementById('pm' + p + 'Status');
        statusEl.textContent = pm.status === 'active' ? 'Aktiv' : pm.status === 'pending' ? 'Ausstehend' : pm.status;
        statusEl.className = 'status-badge ' + (pm.status === 'active' ? 'active' : pm.status === 'pending' ? 'voicemail' : 'missed');

        // Display uses only masked/non-sensitive data (Stripe tokenization, no raw IBAN/card data stored)
        if (pm.type === 'sepa') {
          document.getElementById('pm' + p + 'Info').textContent = pm.iban_last4 ? 'SEPA •••• ' + pm.iban_last4 : 'SEPA-Lastschrift';
          document.getElementById('pm' + p + 'Detail').textContent = (pm.account_holder || '') + (pm.mandate_reference ? ' · Mandat: ' + pm.mandate_reference : '');
        } else if (pm.type === 'credit_card') {
          document.getElementById('pm' + p + 'Info').textContent = (pm.card_brand || 'Karte') + ' •••• ' + (pm.card_last4 || '****');
          document.getElementById('pm' + p + 'Detail').textContent = pm.account_holder || 'Kreditkarte';
        } else if (pm.type === 'paypal') {
          document.getElementById('pm' + p + 'Info').textContent = 'PayPal verbunden';
          document.getElementById('pm' + p + 'Detail').textContent = 'Über Stripe verknüpft';
        }
      } else {
        empty.style.display = '';
        card.style.display = 'none';
        badge.textContent = p === 1 ? 'Nicht hinterlegt' : 'Optional';
      }
    });
  } catch (err) {
    Logger.warn('loadPaymentMethods', 'Table might not exist yet', err);
  }
}

function maskIban(ibanOrLast4) {
  if (!ibanOrLast4) return '–';
  // If only last4 digits provided (from secure storage), show masked format
  if (ibanOrLast4.length <= 4) return 'SEPA •••• ' + ibanOrLast4;
  // Legacy: if full IBAN somehow passed, mask it
  return ibanOrLast4.substring(0, 4) + ' •••• •••• ' + ibanOrLast4.slice(-4);
}

function detectCardBrand(number) {
  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'Amex';
  return 'Karte';
}
