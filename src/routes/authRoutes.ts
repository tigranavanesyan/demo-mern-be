import { Router } from "express";
import {
  adminInfo,
  login,
  logout,
  me,
  register,
} from "../controllers/authController";
import { allowRole, protect } from "../middleware/authMiddleware";

const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.get("/me", protect, me);
authRouter.get("/admin-info", protect, allowRole(["admin"]), adminInfo);

export default authRouter;
