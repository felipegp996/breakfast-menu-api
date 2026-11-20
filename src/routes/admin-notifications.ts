import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/authenticate";
import { Notification } from "../models/notification";

const router = Router();
const pageSize = 10;

router.use(authenticate, requireAdmin);

router.get("/", async (request, response, next) => {
  const requestedPage = typeof request.query.page === "string" ? Number(request.query.page) : 1;
  if (!Number.isInteger(requestedPage) || requestedPage < 1) {
    response.status(400).json({ error: "Page must be a positive integer." });
    return;
  }

  try {
    const [notifications, total] = await Promise.all([
      Notification.find()
        .sort({ orderedAt: -1, _id: -1 })
        .skip((requestedPage - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Notification.countDocuments(),
    ]);

    response.json({
      notifications: notifications.map((notification) => ({
        ...notification,
        _id: notification._id.toString(),
        userId: notification.userId.toString(),
        order: {
          ...notification.order,
          requestId: notification.order.requestId.toString(),
        },
      })),
      page: requestedPage,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    next(error);
  }
});

export default router;