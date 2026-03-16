export const b2bNotificationController = {
  /**
   * @route GET /api/v1/b2b/notifications
   * @desc Get all notifications for the B2B admin
   */
  getAll: async (req, res, next) => {
    try {
      // Return a simulated empty list for now to stop 404s
      res.json({
        status: "success",
        data: []
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route PATCH /api/v1/b2b/notifications/:id/read
   */
  markRead: async (req, res, next) => {
    res.json({ status: "success" });
  },

  /**
   * @route PATCH /api/v1/b2b/notifications/read-all
   */
  markAllRead: async (req, res, next) => {
    res.json({ status: "success" });
  }
};
