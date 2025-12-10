const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getMe
} = require("../controllers/authController");

const { protect } = require("../middleware/auth");

// ✅ REGISTER
router.post("/register", register);

// ✅ LOGIN
router.post("/login", login);

// ✅ GET CURRENT USER
router.get("/me", protect, getMe);

module.exports = router;
