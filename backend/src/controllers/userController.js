const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Order = require('../models/Order');

const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).populate('items.productId').sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserAddresses = async (req, res) => {
  // Address persistence is not available in current schema; return empty list for compatibility.
  res.json([]);
};

const createAddress = async (req, res) => {
  res.status(201).json({ ...req.body, _id: `addr_${Date.now()}` });
};

const updateAddress = async (req, res) => {
  res.json({ ...req.body, _id: req.params.id });
};

const deleteAddress = async (req, res) => {
  res.json({ message: 'Address deleted', _id: req.params.id });
};

const updateUserProfile = async (req, res) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.email) updates.email = req.body.email;

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const changeUserPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const matches = await bcrypt.compare(currentPassword || '', user.password);
    if (!matches) return res.status(400).json({ message: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProfileImage = async (req, res) => {
  const image = req.file ? `${process.env.BASE_URL}/uploads/${req.file.filename}` : null;
  res.json({ image });
};

module.exports = {
  getUserOrders,
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  updateUserProfile,
  changeUserPassword,
  updateProfileImage,
};
