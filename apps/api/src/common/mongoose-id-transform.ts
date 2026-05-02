import * as mongoose from 'mongoose';

/**
 * Plugin global Mongoose : toutes les sérialisations JSON exposent `id`
 * (string) au lieu de `_id` (ObjectId) et masquent le `__v` interne.
 *
 * Effets :
 *  - Les réponses HTTP des controllers qui renvoient des Documents Mongo
 *    sont nettoyées automatiquement (NestJS appelle `JSON.stringify`, qui
 *    appelle `toJSON()` du Document, qui passe par notre transform).
 *  - Aucun champ technique Mongo ne fuit côté frontend.
 *
 * IMPORTANT : ce fichier doit être importé pour son SIDE EFFECT (i.e. en
 * premier dans `main.ts`), avant le chargement d'AppModule, sinon les
 * schemas déjà compilés via `SchemaFactory.createForClass` au moment de
 * l'import des modules ne recevront pas le plugin.
 */
mongoose.plugin((schema) => {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false, // → supprime `__v`
    transform(_doc, ret) {
      if (ret._id !== undefined) {
        ret.id = String(ret._id);
        delete ret._id;
      } else if (ret.id !== undefined && typeof ret.id !== 'string') {
        // Au cas où `id` virtual existe déjà mais n'est pas string.
        ret.id = String(ret.id);
      }
      // Sécurité défensive : strip d'éventuels `__v` résiduels.
      delete (ret as Record<string, unknown>).__v;
      return ret;
    },
  });
});
