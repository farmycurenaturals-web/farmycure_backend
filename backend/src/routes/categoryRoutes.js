const express = require('express');
const router = express.Router();
const { getCategories, createCategory } = require('../controllers/categoryController');
const { requireAuth, allowRoles } = require('../middleware/authMiddleware');
const { uploadImage } = require('../middleware/upload');

router.get('/', getCategories);
router.post('/', requireAuth, allowRoles('admin', 'owner'), uploadImage.single('image'), createCategory);

module.exports = router;
