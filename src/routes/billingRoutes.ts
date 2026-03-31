import { Router } from "express";
import {
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
  getProductEntitlement,
  recordUsage,
} from "../controllers/billingController";
import { protect } from "../middleware/authMiddleware";

const billingRouter = Router();

billingRouter.get("/status", protect, getBillingStatus);
billingRouter.post("/checkout-session", protect, createCheckoutSession);
billingRouter.post("/portal-session", protect, createPortalSession);
billingRouter.post("/usage/record", protect, recordUsage);
billingRouter.get("/entitlements/:productKey", protect, getProductEntitlement);

export default billingRouter;
