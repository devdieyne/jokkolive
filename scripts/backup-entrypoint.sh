#!/bin/sh
# Boucle cron-like simple : exécute le backup à l'heure définie (par défaut 03:00 UTC)
# puis dort jusqu'au prochain créneau. Évite de dépendre de cron dans le container.

set -eu

BACKUP_HOUR=${BACKUP_HOUR:-3}     # heure UTC du dump (0-23)
BACKUP_MINUTE=${BACKUP_MINUTE:-0} # minute du dump (0-59)

echo "📅 Backup planifié à ${BACKUP_HOUR}h${BACKUP_MINUTE} UTC, rétention ${RETENTION_DAYS:-7} jours"

# Backup immédiat au démarrage si BACKUP_ON_START=1 (utile pour test)
if [ "${BACKUP_ON_START:-0}" = "1" ]; then
  /scripts/backup-mongo.sh || echo "⚠️  Backup initial échoué"
fi

while true; do
  NOW_HOUR=$(date -u +%H)
  NOW_MIN=$(date -u +%M)

  # Convertit en minutes depuis 00:00 UTC pour calculer le délai
  NOW_MINUTES=$((10#$NOW_HOUR * 60 + 10#$NOW_MIN))
  TARGET_MINUTES=$((BACKUP_HOUR * 60 + BACKUP_MINUTE))

  if [ "$NOW_MINUTES" -lt "$TARGET_MINUTES" ]; then
    SLEEP_SECONDS=$(( (TARGET_MINUTES - NOW_MINUTES) * 60 ))
  else
    # Demain à HH:MM
    SLEEP_SECONDS=$(( (24 * 60 - NOW_MINUTES + TARGET_MINUTES) * 60 ))
  fi

  echo "⏰ Prochain backup dans ${SLEEP_SECONDS}s ($(date -u -d "+$SLEEP_SECONDS seconds" 2>/dev/null || date -u))"
  sleep "$SLEEP_SECONDS"

  /scripts/backup-mongo.sh || echo "⚠️  Backup échoué — réessai demain"
done
