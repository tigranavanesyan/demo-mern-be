import { Router } from "express";
import { login, logout, me, register } from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.get("/me", protect, me);

export default authRouter;
