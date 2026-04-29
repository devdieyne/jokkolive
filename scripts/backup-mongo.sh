#!/bin/sh
# Backup quotidien MongoDB — exécuté dans le conteneur tiktok_backup
# Garde 7 jours d'historique, ancien dossier supprimé automatiquement

set -eu

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
TARGET="$BACKUP_DIR/$TIMESTAMP"
RETENTION_DAYS=${RETENTION_DAYS:-7}

mkdir -p "$TARGET"

echo "[$(date)] 🔄 Démarrage du dump MongoDB → $TARGET"

mongodump \
  --host "$MONGO_HOST" \
  --username "$MONGO_USER" \
  --password "$MONGO_PASSWORD" \
  --authenticationDatabase admin \
  --db "$MONGO_DB" \
  --out "$TARGET" \
  --gzip

echo "[$(date)] ✅ Dump terminé : $(du -sh "$TARGET" | cut -f1)"

# Rétention : supprime les backups plus vieux que RETENTION_DAYS jours
echo "[$(date)] 🧹 Nettoyage des dumps > $RETENTION_DAYS jours"
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \;

echo "[$(date)] 📦 Backups actuels :"
ls -lh "$BACKUP_DIR" | tail -n +2
