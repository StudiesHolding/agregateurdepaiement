import express from "express";
import { NotificationController } from "../controllers/notification.controller.js";

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get all configured admin notification settings
 * @access  Admin
 */
router.get("/", NotificationController.getSettings);

/**
 * @route   GET /api/notifications/search
 * @desc    Search potential admin users in the LMS database
 * @access  Admin
 */
router.get("/search", NotificationController.searchLmsUsers);

/**
 * @route   POST /api/notifications
 * @desc    Add or Update notification settings for an admin email
 * @access  Admin
 */
router.post("/", NotificationController.updateSetting);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification setting record
 * @access  Admin
 */
router.delete("/:id", NotificationController.deleteSetting);

export default router;
