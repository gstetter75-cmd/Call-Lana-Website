#!/bin/bash
# =============================================
# Call Lana: Setup-Skript für alle externen Dienste
# =============================================

PROJECT_REF="fgwtptriileytmmotevs"
REPO="gstetter75-cmd/Call-Lana-Merged"

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
echo "  Bitte die folgenden Werte eingeben (leer lassen zum Überspringen):"
echo ""

read -p "  STRIPE_SECRET_KEY (sk_live_... oder sk_test_...): " STRIPE_KEY
read -p "  STRIPE_WEBHOOK_SECRET (whsec_...): " STRIPE_WH
read -p "  RESEND_API_KEY (re_...): " RESEND_KEY
read -p "  VAPI_WEBHOOK_SECRET (beliebiger String): " VAPI_SECRET

# Generate encryption key if not provided
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "  ENCRYPTION_KEY (auto-generiert): $ENCRYPTION_KEY"

# Generate VAPID keys
echo "  VAPID Keys generieren..."
VAPID_KEYS=$(npx web-push generate-vapid-keys --json 2>/dev/null || echo '{}')
VAPID_PUBLIC=$(echo "$VAPID_KEYS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('publicKey',''))" 2>/dev/null)
VAPID_PRIVATE=$(echo "$VAPID_KEYS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('privateKey',''))" 2>/dev/null)

# Set all secrets
SECRETS="ENCRYPTION_KEY=$ENCRYPTION_KEY"
SECRETS="$SECRETS ALLOWED_ORIGIN=https://call-lana.de"
[ -n "$STRIPE_KEY" ] && SECRETS="$SECRETS STRIPE_SECRET_KEY=$STRIPE_KEY"
[ -n "$STRIPE_WH" ] && SECRETS="$SECRETS STRIPE_WEBHOOK_SECRET=$STRIPE_WH"
[ -n "$RESEND_KEY" ] && SECRETS="$SECRETS RESEND_API_KEY=$RESEND_KEY"
[ -n "$VAPI_SECRET" ] && SECRETS="$SECRETS VAPI_WEBHOOK_SECRET=$VAPI_SECRET"
[ -n "$VAPID_PUBLIC" ] && SECRETS="$SECRETS VAPID_PUBLIC_KEY=$VAPID_PUBLIC VAPID_PRIVATE_KEY=$VAPID_PRIVATE"

supabase secrets set $SECRETS --project-ref "$PROJECT_REF"
echo "  ✅ Secrets gesetzt"
echo ""

# ---- 3. GitHub Secrets setzen ----
echo "🔑 GitHub Actions Secrets setzen..."
gh secret set SUPABASE_URL --body "https://${PROJECT_REF}.supabase.co" --repo "$REPO" 2>/dev/null
gh secret set SUPABASE_ANON_KEY --body "sb_publishable_T6YW1YX3EfTakMg2m5APqA_uVSDdi5S" --repo "$REPO" 2>/dev/null
gh secret set TEST_ADMIN_EMAIL --body "gstetter75@googlemail.com" --repo "$REPO" 2>/dev/null
gh secret set TEST_ADMIN_PASSWORD --body "Abcund123.." --repo "$REPO" 2>/dev/null
gh secret set TEST_CUSTOMER_EMAIL --body "g.stetter@gmx.net" --repo "$REPO" 2>/dev/null
gh secret set TEST_CUSTOMER_PASSWORD --body "Abcund123.." --repo "$REPO" 2>/dev/null
echo "  ✅ GitHub Secrets gesetzt"
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
