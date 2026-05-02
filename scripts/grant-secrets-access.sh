#!/usr/bin/env bash
#
# Grant à la Service Account Firebase App Hosting le rôle `secretAccessor`
# sur tous les secrets référencés par `apps/api/apphosting.yaml`.
#
# Prérequis : les secrets doivent déjà exister dans Secret Manager
# (cf. ./create-secrets.sh ou création manuelle via console GCP).
#
# Usage :
#   ./scripts/grant-secrets-access.sh <PROJECT_ID>
#   # ou via env var :
#   GCP_PROJECT_ID=jokko-487420 ./scripts/grant-secrets-access.sh

set -euo pipefail

PROJECT_ID="${1:-${GCP_PROJECT_ID:-}}"
if [ -z "$PROJECT_ID" ]; then
  echo "❌ Usage : $0 <PROJECT_ID>"
  echo "   Exemple : $0 jokko-487420"
  exit 1
fi

# Service Account créée automatiquement par Firebase App Hosting au premier
# backend déployé sur le projet. Format documenté :
# https://firebase.google.com/docs/app-hosting/configure#secret-parameters
SERVICE_ACCOUNT="firebase-app-hosting-compute@${PROJECT_ID}.iam.gserviceaccount.com"

# Liste des secrets référencés dans apps/api/apphosting.yaml.
# Garder cette liste alignée avec apphosting.yaml.
SECRETS=(
  MONGO_URI
  MONGO_DB_NAME
  JWT_SECRET
  WHATSAPP_CLOUD_PHONE_NUMBER_ID
  WHATSAPP_CLOUD_WABA_ID
  WHATSAPP_CLOUD_TOKEN
  WHATSAPP_CLOUD_APP_SECRET
  WHATSAPP_CLOUD_VERIFY_TOKEN
  DIAMANO_PAY_TOKEN
)

echo "🔧 Project : ${PROJECT_ID}"
echo "🤖 Service Account : ${SERVICE_ACCOUNT}"
echo "🔐 ${#SECRETS[@]} secrets à autoriser"
echo

failed=()
for secret in "${SECRETS[@]}"; do
  printf "  → %-40s " "${secret}"
  if gcloud secrets add-iam-policy-binding "${secret}" \
       --project="${PROJECT_ID}" \
       --member="serviceAccount:${SERVICE_ACCOUNT}" \
       --role="roles/secretmanager.secretAccessor" \
       --quiet >/dev/null 2>&1; then
    echo "✅"
  else
    echo "❌"
    failed+=("${secret}")
  fi
done

echo
if [ ${#failed[@]} -eq 0 ]; then
  echo "✅ Toutes les permissions appliquées."
else
  echo "⚠️  ${#failed[@]} secret(s) en échec :"
  for s in "${failed[@]}"; do echo "   - ${s}"; done
  echo
  echo "Causes probables :"
  echo "  - Le secret n'existe pas encore (créer via ./scripts/create-secrets.sh)"
  echo "  - L'API Secret Manager n'est pas activée (gcloud services enable secretmanager.googleapis.com)"
  echo "  - Tu n'as pas les permissions (rôle Secret Manager Admin requis)"
  exit 1
fi
