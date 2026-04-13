const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { uploadImage } = require('../middleware/upload');
const {
  updateProfileImage,
  getMyOrders,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  updateProfile,
  changePassword
} = require('../controllers/userController');

router.get('/orders', requireAuth, getMyOrders);
router.get('/addresses', requireAuth, getAddresses);
router.post('/address', requireAuth, createAddress);
router.put('/address/:id', requireAuth, updateAddress);
router.delete('/address/:id', requireAuth, deleteAddress);
router.put('/profile', requireAuth, updateProfile);
router.put('/password', requireAuth, changePassword);
router.put('/profile-image', requireAuth, uploadImage.single('image'), updateProfileImage);

module.exports = router;
