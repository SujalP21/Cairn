import express from "express";
import {
  signupSchema,
  loginSchema,
  updateProfileSchema,
  idParams,
} from "@cairn/shared";
import * as userController from "../controllers/userController";
import { validate } from "../middleware/validate";
import {
  authenticate,
  authenticateOptional,
} from "../middleware/authMiddleware";
import { requireSelf } from "../middleware/authorizeMiddleware";
import { authLimiter, signupLimiter } from "../middleware/rateLimit";
import { requireClientHeader } from "../middleware/csrfMiddleware";

const userRouter = express.Router();

// ---------------------------------------------------------------------------
// Route                        Auth        Authorization
// ---------------------------------------------------------------------------
// POST   /signup               public      rate limited (5/hour)
// POST   /login                public      rate limited (10/15min)
// POST   /refresh              cookie      rotation + CSRF client header
// POST   /logout               cookie      revokes token + CSRF client header
// GET    /allUsers             required    identity fields only
// GET    /userProfile/:id      optional    email disclosed to self only
// PUT    /updateProfile/:id    required    self only
// DELETE /deleteProfile/:id    required    self only
// ---------------------------------------------------------------------------

userRouter.post(
  "/signup",
  signupLimiter,
  validate({ body: signupSchema }),
  userController.signup
);

userRouter.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  userController.login
);

// Cookie-authenticated: both need the CSRF client-header guard.
userRouter.post(
  "/refresh",
  authLimiter,
  requireClientHeader,
  userController.refresh
);
userRouter.post("/logout", requireClientHeader, userController.logout);

userRouter.get("/allUsers", authenticate, userController.getAllUsers);

userRouter.get(
  "/userProfile/:id",
  authenticateOptional,
  validate({ params: idParams }),
  userController.getUserProfile
);

userRouter.put(
  "/updateProfile/:id",
  authenticate,
  validate({ params: idParams, body: updateProfileSchema }),
  requireSelf("id"),
  userController.updateUserProfile
);

userRouter.delete(
  "/deleteProfile/:id",
  authenticate,
  validate({ params: idParams }),
  requireSelf("id"),
  userController.deleteUserProfile
);

export default userRouter;
