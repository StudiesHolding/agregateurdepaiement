-- Corrige les tables créées sans AUTO_INCREMENT (INSERT échoue avec id=0)

DELETE FROM `aggp_admin_notifications` WHERE `id` = 0;
ALTER TABLE `aggp_admin_notifications`
  MODIFY `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT;

DELETE FROM `aggp_webhook_events` WHERE `id` = 0;
ALTER TABLE `aggp_webhook_events`
  MODIFY `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT;
