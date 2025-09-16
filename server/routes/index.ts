import { Router } from "express";
import authRouter from "./auth";
import { login, stepUp } from "../controllers/authController";

const router = Router();

// mount versioned or namespaced routers
router.use("/auth", authRouter);

// legacy endpoints for backwards compatibility
// router.post("/login", login);
// router.post("/step-up", stepUp);

export default router;
