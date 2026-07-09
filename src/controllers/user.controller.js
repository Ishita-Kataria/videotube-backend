import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
    // Step 1: Data lo
    const { fullName, email, username, password } = req.body;

    // Step 2: Validation
    if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "Saari fields zaruri hain!");
    }

    // Step 3: User exist check
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User already exist karta hai!");
    }

    // Step 4: Files handle karo
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file zaruri hai!");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar upload nahi hua!");
    }

    // Step 5: User banao
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    });

    // Step 6: Response bhejo
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "User register nahi hua!");
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User successfully register hua!")
    );
});
const loginUser = asyncHandler(async (req, res) => {
    // Step 1: Data lo
    const { email, username, password } = req.body;

    // Step 2: Validation
    if (!username && !email) {
        throw new ApiError(400, "Username ya Email zaruri hai!");
    }

    // Step 3: User dhundo
    const user = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (!user) {
        throw new ApiError(404, "User exist nahi karta!");
    }

    // Step 4: Password check
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Password galat hai!");
    }

    // Step 5: Tokens banao
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // Step 6: Cookies + Response
    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "Login successful!"
            )
        );
});
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: 1 }
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "Logout successful!"));
});
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request!");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token!");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token expired!");
        }

        const accessToken = user.generateAccessToken();
        const newRefreshToken = user.generateRefreshToken();

        user.refreshToken = newRefreshToken;
        await user.save({ validateBeforeSave: false });

        const options = {
            httpOnly: true,
            secure: true
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access Token refreshed!"));

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token!");
    }
});
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Purana password galat hai!");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully!"));
});
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched!"));
});
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "Fullname aur Email zaruri hai!");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: { fullName, email }
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated!"));
});
const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file missing!");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(400, "Avatar upload nahi hua!");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: { avatar: avatar.url }
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar updated!"));
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar
};