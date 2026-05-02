#!/usr/bin/env bash
#
# Crée tous les secrets référencés par apps/api/apphosting.yaml dans
# Google Secret Manager. Mode interactif : prompt pour chaque valeur,
# skip si le secret existe déjà.
#
# Pour les secrets aléatoires (JWT_SECRET, WHATSAPP_CLOUD_VERIFY_TOKEN),
# on auto-génère via openssl si aucune valeur n'est fournie.
#
# Usage :
#   ./scripts/create-secrets.sh <PROJECT_ID>
#   GCP_PROJECT_ID=jokko-487420 ./scripts/create-secrets.sh
#
# Après création, lancer ./grant-secrets-access.sh pour donner accès à
# la Service Account App Hosting.

set -euo pipefail

PROJECT_ID="${1:-${GCP_PROJECT_ID:-}}"
if [ -z "$PROJECT_ID" ]; then
  echo "❌ Usage : $0 <PROJECT_ID>"
  exit 1
fi

# Activer l'API Secret Manager si pas déjà fait (idempotent).
gcloud services enable secretmanager.googleapis.com --project="${PROJECT_ID}" --quiet

# Format : "SECRET_NAME|description (humain)|auto-generate?"
# auto-generate=1 → propose une valeur via openssl rand -hex 32 si vide
SECRETS=(
  "MONGO_URI|URI MongoDB Atlas (mongodb+srv://USER:PASS@cluster.mongodb.net/?retryWrites=true&w=majority)|0"
  "MONGO_DB_NAME|Nom de la database (ex: jokkolive)|0"
  "JWT_SECRET|Secret JWT (laisser vide → auto-généré 256 bits)|1"
  "WHATSAPP_CLOUD_PHONE_NUMBER_ID|Phone Number ID Meta (chiffres)|0"
  "WHATSAPP_CLOUD_WABA_ID|WhatsApp Business Account ID Meta|0"
  "WHATSAPP_CLOUD_TOKEN|System User Token Meta (Never expires)|0"
  "WHATSAPP_CLOUD_APP_SECRET|App Secret Meta (Settings → Basic → Show)|0"
  "WHATSAPP_CLOUD_VERIFY_TOKEN|Token verify webhook Meta (laisser vide → auto-généré)|1"
  "DIAMANO_PAY_TOKEN|Token API DiamanoPay|0"
)

echo "🔧 Project : ${PROJECT_ID}"
echo "🔐 ${#SECRETS[@]} secrets à créer"
echo

for entry in "${SECRETS[@]}"; do
  IFS='|' read -r name desc auto <<< "${entry}"

  # Skip si déjà existant (idempotent — ne pas écraser une valeur en place)
  if gcloud secrets describe "${name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "⏭  ${name} existe déjà — skip"
    continue
  fi

  echo
  echo "── ${name} ──"
  echo "   ${desc}"
  read -r -s -p "   Valeur : " value
  echo

  if [ -z "${value}" ]; then
    if [ "${auto}" = "1" ]; then
      value="$(openssl rand -hex 32)"
      echo "   🎲 Auto-généré (openssl rand -hex 32)"
    else
      echo "   ⚠️  Valeur vide, secret non créé. Relancer plus tard pour ${name}."
      continue
    fi
  fi

  if printf '%s' "${value}" | gcloud secrets create "${name}" \
       --project="${PROJECT_ID}" \
       --data-file=- \
       --replication-policy=automatic \
       --quiet; then
    echo "   ✅ Créé"
  else
    echo "   ❌ Échec création"
  fi
done

echo
echo "✅ Terminé. Donner maintenant l'accès à la Service Account App Hosting :"
echo "   ./scripts/grant-secrets-access.sh ${PROJECT_ID}"
