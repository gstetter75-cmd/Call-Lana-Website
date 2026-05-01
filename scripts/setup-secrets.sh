#!/bin/bash
# =============================================
# Call Lana: Setup-Skript für alle externen Dienste
# =============================================
# Sicherheitshinweis:
#   Dieses Skript enthält bewusst KEINE hardcoded Project-Refs,
#   API-Keys, E-Mails oder Passwörter. Alle sensiblen Werte werden
#   interaktiv beim Ausführen abgefragt und nicht eingecheckt.

read -r -p "Supabase project ref: " PROJECT_REF
if [ -z "$PROJECT_REF" ]; then
  echo "❌ Supabase project ref ist erforderlich." >&2
  exit 1
fi

read -r -p "GitHub repo (owner/repo, leer lassen zum Überspringen der GitHub-Secrets): " REPO

echo ""
echo "=== Call Lana Setup ==="
echo ""

# ---- 1. Supabase Edge Functions deployen ----
echo "📦 Edge Functions deployen..."
for fn in create-payment-method encrypt-secret send-invoice-email send-welcome-email stripe-webhook vapi-webhook create-checkout-session; do
  echo "  → $fn"
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF" 2>&1 | tail -1
done
echo ""

# ---- 2. Supabase Secrets setzen ----
echo "🔐 Supabase Secrets setzen..."
echo "  Bitte die folgenden Werte eingeben (leer lassen zum Überspringen)."
echo "  Eingaben werden nicht angezeigt."
echo ""

read -r -s -p "  STRIPE_SECRET_KEY (sk_live_... oder sk_test_...): " STRIPE_KEY; echo ""
read -r -s -p "  STRIPE_WEBHOOK_SECRET (whsec_...): " STRIPE_WH; echo ""
read -r -s -p "  RESEND_API_KEY (re_...): " RESEND_KEY; echo ""
read -r -s -p "  VAPI_WEBHOOK_SECRET (beliebiger String): " VAPI_SECRET; echo ""

# ENCRYPTION_KEY: NICHT automatisch rotieren!
# Wird ENCRYPTION_KEY ohne Re-Encryption ersetzt, sind bereits verschlüsselte
# Connector-/API-Secrets unlesbar. Default ist deshalb: nicht anfassen.
ENCRYPTION_KEY=""
read -r -p "ENCRYPTION_KEY setzen/ändern? Nur bei Fresh Setup oder geplanter Rotation. [y/N] " ENC_CHOICE
case "$ENC_CHOICE" in
  y|Y|yes|YES)
    read -r -s -p "  Vorhandenen ENCRYPTION_KEY einfügen? Leer lassen = neu generieren: " ENC_INPUT; echo ""
    if [ -n "$ENC_INPUT" ]; then
      ENCRYPTION_KEY="$ENC_INPUT"
      echo "  ENCRYPTION_KEY übernommen (nicht angezeigt)."
    else
      ENCRYPTION_KEY=$(openssl rand -base64 32)
      echo "  ENCRYPTION_KEY neu generiert und wird gesetzt. Wert wird nicht angezeigt."
    fi
    unset ENC_INPUT
    ;;
  *)
    echo "  ENCRYPTION_KEY bleibt unverändert (übersprungen)."
    ;;
esac
unset ENC_CHOICE

echo "  VAPID Keys generieren..."
VAPID_KEYS=$(npx web-push generate-vapid-keys --json 2>/dev/null || echo '{}')
VAPID_PUBLIC=$(echo "$VAPID_KEYS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('publicKey',''))" 2>/dev/null)
VAPID_PRIVATE=$(echo "$VAPID_KEYS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('privateKey',''))" 2>/dev/null)

SECRETS="ALLOWED_ORIGIN=https://call-lana.de"
[ -n "$ENCRYPTION_KEY" ] && SECRETS="$SECRETS ENCRYPTION_KEY=$ENCRYPTION_KEY"
[ -n "$STRIPE_KEY" ] && SECRETS="$SECRETS STRIPE_SECRET_KEY=$STRIPE_KEY"
[ -n "$STRIPE_WH" ] && SECRETS="$SECRETS STRIPE_WEBHOOK_SECRET=$STRIPE_WH"
[ -n "$RESEND_KEY" ] && SECRETS="$SECRETS RESEND_API_KEY=$RESEND_KEY"
[ -n "$VAPI_SECRET" ] && SECRETS="$SECRETS VAPI_WEBHOOK_SECRET=$VAPI_SECRET"
[ -n "$VAPID_PUBLIC" ] && SECRETS="$SECRETS VAPID_PUBLIC_KEY=$VAPID_PUBLIC VAPID_PRIVATE_KEY=$VAPID_PRIVATE"

supabase secrets set $SECRETS --project-ref "$PROJECT_REF"
unset STRIPE_KEY STRIPE_WH RESEND_KEY VAPI_SECRET ENCRYPTION_KEY VAPID_PRIVATE
echo "  ✅ Supabase Secrets gesetzt"
echo ""

# ---- 3. GitHub Secrets setzen ----
if [ -n "$REPO" ]; then
  echo "🔑 GitHub Actions Secrets setzen..."
  gh secret set SUPABASE_URL --body "https://${PROJECT_REF}.supabase.co" --repo "$REPO"

  read -r -s -p "  SUPABASE_ANON_KEY (publishable key, leer = skip): " SB_ANON; echo ""
  [ -n "$SB_ANON" ] && gh secret set SUPABASE_ANON_KEY --body "$SB_ANON" --repo "$REPO"
  unset SB_ANON

  # Test-User Credentials für CI/E2E.
  # Test-User müssen vorher manuell in Supabase Auth angelegt werden.
  # Werte werden interaktiv abgefragt; Passwörter werden nicht angezeigt.
  echo ""
  echo "  Test-User für CI (leer lassen zum Überspringen):"
  read -r -p "    TEST_ADMIN_EMAIL: " TEST_ADMIN_EMAIL
  read -r -s -p "    TEST_ADMIN_PASSWORD: " TEST_ADMIN_PASSWORD; echo ""
  read -r -p "    TEST_CUSTOMER_EMAIL: " TEST_CUSTOMER_EMAIL
  read -r -s -p "    TEST_CUSTOMER_PASSWORD: " TEST_CUSTOMER_PASSWORD; echo ""

  [ -n "$TEST_ADMIN_EMAIL" ]    && gh secret set TEST_ADMIN_EMAIL    --body "$TEST_ADMIN_EMAIL"    --repo "$REPO"
  [ -n "$TEST_ADMIN_PASSWORD" ] && gh secret set TEST_ADMIN_PASSWORD --body "$TEST_ADMIN_PASSWORD" --repo "$REPO"
  [ -n "$TEST_CUSTOMER_EMAIL" ]    && gh secret set TEST_CUSTOMER_EMAIL    --body "$TEST_CUSTOMER_EMAIL"    --repo "$REPO"
  [ -n "$TEST_CUSTOMER_PASSWORD" ] && gh secret set TEST_CUSTOMER_PASSWORD --body "$TEST_CUSTOMER_PASSWORD" --repo "$REPO"
  unset TEST_ADMIN_EMAIL TEST_ADMIN_PASSWORD TEST_CUSTOMER_EMAIL TEST_CUSTOMER_PASSWORD
  echo "  ✅ GitHub Secrets gesetzt"
else
  echo "🔑 GitHub Secrets übersprungen (kein Repo angegeben)"
fi
echo ""

# ---- 4. DNS Anleitung ----
echo "🌐 Custom Domain (call-lana.de) einrichten:"
echo "  Bei deinem Domain-Provider diese DNS-Einträge setzen:"
echo ""
echo "  Typ    Name    Wert"
echo "  CNAME  www     gstetter75-cmd.github.io"
echo "  A      @       185.199.108.153"
echo "  A      @       185.199.109.153"
echo "  A      @       185.199.110.153"
echo "  A      @       185.199.111.153"
echo ""
echo "  Dann in GitHub: Settings → Pages → Custom domain → call-lana.de"
echo ""

echo "=== Setup abgeschlossen! ==="
echo ""
echo "Nächste Schritte:"
echo "  1. supabase login  (falls noch nicht eingeloggt)"
echo "  2. bash scripts/setup-secrets.sh  (dieses Skript nochmal mit API-Keys)"
echo "  3. DNS-Einträge bei Domain-Provider setzen"
echo "  4. GitHub Pages Custom Domain aktivieren"
