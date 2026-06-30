/**
 * Validation des formations B2C — doit exister dans sl_course_mapping (SYNCED).
 * Garantit qu'on n'inscrit jamais sur une formation fantôme.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

export class FormationMappingService {
  /**
   * @returns {{ slFormationId: number, moodleCourseId: number, moodleInstanceId: number } | null}
   */
  static async resolveSyncedFormation(formationId) {
    const id = Number(formationId);
    if (!id || id <= 0) return null;

    const [row] = await sequelize.query(
      `SELECT sl_formation_id, moodle_course_id, moodle_instance_id
       FROM sl_course_mapping
       WHERE sl_formation_id = :id AND sync_status = 'SYNCED'
       LIMIT 1`,
      { replacements: { id }, type: QueryTypes.SELECT },
    );

    if (!row) return null;

    return {
      slFormationId: Number(row.sl_formation_id),
      moodleCourseId: Number(row.moodle_course_id),
      moodleInstanceId: Number(row.moodle_instance_id ?? 1),
    };
  }

  static async assertFormationMappable(formationId) {
    const mapping = await this.resolveSyncedFormation(formationId);
    if (!mapping) {
      throw Object.assign(
        new Error(
          `Formation ${formationId} introuvable ou non synchronisée avec Moodle (sl_course_mapping)`,
        ),
        { statusCode: 422, code: "FORMATION_NOT_MAPPED" },
      );
    }
    return mapping;
  }
}
