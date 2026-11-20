import { Schema, Types, type Model } from "mongoose";
import { dbConnections } from "../config/database";

export interface NotificationIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface NotificationDocument {
  userId: Types.ObjectId;
  userName: string;
  userEmail: string;
  order: {
    requestId: Types.ObjectId;
    serviceDate: string;
    recipe: {
      name: string;
      description: string;
      imageUrl: string;
      ingredients: NotificationIngredient[];
    };
  };
  orderedAt: Date;
}

const notificationIngredientSchema = new Schema<NotificationIngredient>(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: Number.EPSILON },
    unit: { type: String, required: true },
  },
  { _id: false },
);

const notificationSchema = new Schema<NotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    order: {
      requestId: { type: Schema.Types.ObjectId, required: true },
      serviceDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
      recipe: {
        name: { type: String, required: true },
        description: { type: String, required: true },
        imageUrl: { type: String, required: true },
        ingredients: { type: [notificationIngredientSchema], required: true },
      },
    },
    orderedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

notificationSchema.index({ orderedAt: -1, _id: -1 });

const existingNotificationModel = dbConnections.users.models.Notification as Model<NotificationDocument> | undefined;

export const Notification =
  existingNotificationModel ??
  dbConnections.users.model<NotificationDocument>("Notification", notificationSchema);