import { Router } from "express";
import {
  login,
  stepUp,
  profile,
  logout,
  validate,
} from "../controllers/authController";

const router = Router();

// In Express, this module will be mounted at /api/auth by routes/index.ts
router.get("/profile", profile);
router.get("/validate", validate);
router.post("/logout", logout);
router.post("/login", login);
router.post("/step-up", stepUp);

// expose legacy endpoints as named exports for routes/index to mount
export const handleLoginLegacy = login;
export const handleStepUpLegacy = stepUp;

export default router;
