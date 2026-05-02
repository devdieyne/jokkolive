#!/usr/bin/env bash
#
# Donne accès aux secrets Secret Manager au backend Firebase App Hosting.
#
# Utilise `firebase apphosting:secrets:grantaccess` (pas gcloud direct) car
# App Hosting a plusieurs Service Accounts internes (build + runtime) que
# Firebase gère pour nous. La commande gcloud directe ne couvre pas tout.
#
# Prérequis :
#   - Firebase CLI installée : npm install -g firebase-tools
#   - Connecté : firebase login
#   - Les secrets existent (cf. ./create-secrets.sh)
#
# Usage :
#   ./scripts/grant-secrets-access.sh <PROJECT_ID> <BACKEND_NAME>
#   ./scripts/grant-secrets-access.sh jokko-487420 jokkolive-api
#
# Pour lister les backends disponibles :
#   firebase apphosting:backends:list --project <PROJECT_ID>

set -euo pipefail

PROJECT_ID="${1:-${GCP_PROJECT_ID:-}}"
BACKEND_NAME="${2:-${APP_HOSTING_BACKEND:-}}"

if [ -z "$PROJECT_ID" ] || [ -z "$BACKEND_NAME" ]; then
  echo "❌ Usage : $0 <PROJECT_ID> <BACKEND_NAME>"
  echo "   Exemple : $0 jokko-487420 jokkolive-api"
  echo
  echo "Pour lister les backends :"
  echo "   firebase apphosting:backends:list --project ${PROJECT_ID:-<PROJECT_ID>}"
  exit 1
fi

# Vérifier que la CLI Firebase est installée
if ! command -v firebase >/dev/null 2>&1; then
  echo "❌ Firebase CLI manquante."
  echo "   Installer : npm install -g firebase-tools"
  echo "   Puis : firebase login"
  exit 1
fi

# Liste des secrets référencés dans apps/api/apphosting.yaml.
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

echo "🔧 Project   : ${PROJECT_ID}"
echo "🎯 Backend   : ${BACKEND_NAME}"
echo "🔐 Secrets   : ${#SECRETS[@]}"
echo

failed=()
for secret in "${SECRETS[@]}"; do
  printf "  → %-40s " "${secret}"
  if firebase apphosting:secrets:grantaccess "${secret}" \
       --project="${PROJECT_ID}" \
       --backend="${BACKEND_NAME}" \
       --force >/dev/null 2>&1; then
    echo "✅"
  else
    echo "❌"
    failed+=("${secret}")
  fi
done

echo
if [ ${#failed[@]} -eq 0 ]; then
  echo "✅ Toutes les permissions appliquées."
  echo "   Tu peux relancer le déploiement App Hosting."
else
  echo "⚠️  ${#failed[@]} secret(s) en échec :"
  for s in "${failed[@]}"; do echo "   - ${s}"; done
  echo
  echo "Tester manuellement pour voir l'erreur exacte :"
  echo "   firebase apphosting:secrets:grantaccess ${failed[0]} \\"
  echo "     --project=${PROJECT_ID} --backend=${BACKEND_NAME}"
  exit 1
fi
