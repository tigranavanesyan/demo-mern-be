import { Router } from "express";
import {
  adminInfo,
  login,
  loginWithGoogle,
  logout,
  me,
  register,
  updateRole,
} from "../controllers/authController";
import { allowRole, protect } from "../middleware/authMiddleware";

const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/google", loginWithGoogle);
authRouter.post("/logout", logout);
authRouter.get("/me", protect, me);
authRouter.patch("/role", protect, allowRole(["admin"]), updateRole);
authRouter.get("/admin-info", protect, allowRole(["admin"]), adminInfo);

export default authRouter;
