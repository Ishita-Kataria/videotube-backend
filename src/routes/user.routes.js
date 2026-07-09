import { Router } from "express";
import { registerUser, loginUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { registerUser, loginUser, logoutUser } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { registerUser, loginUser, logoutUser, refreshAccessToken } from "../controllers/user.controller.js";
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar
} from "../controllers/user.controller.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "coverImage", maxCount: 1 }
    ]),
    registerUser
);

router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar);


export default router;