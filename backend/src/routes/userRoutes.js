const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getUserOrders,
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  updateUserProfile,
  changeUserPassword,
  updateProfileImage,
} = require('../controllers/userController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

router.get('/orders', authMiddleware, getUserOrders);
router.get('/addresses', authMiddleware, getUserAddresses);
router.post('/address', authMiddleware, createAddress);
router.put('/address/:id', authMiddleware, updateAddress);
router.delete('/address/:id', authMiddleware, deleteAddress);
router.put('/profile', authMiddleware, updateUserProfile);
router.put('/password', authMiddleware, changeUserPassword);
router.put('/profile-image', authMiddleware, upload.single('image'), updateProfileImage);

module.exports = router;
