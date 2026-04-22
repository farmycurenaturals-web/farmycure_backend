const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  saveAddress,
  getAddresses,
  deleteAddress,
  setDefaultAddress,
} = require('../controllers/addressController');

router.post('/', authMiddleware, saveAddress);
router.get('/', authMiddleware, getAddresses);
router.delete('/:id', authMiddleware, deleteAddress);
router.patch('/:id/default', authMiddleware, setDefaultAddress);

module.exports = router;
