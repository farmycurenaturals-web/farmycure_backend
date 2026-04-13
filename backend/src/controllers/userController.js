const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Address = require('../models/Address');
const Order = require('../models/Order');

const buildAssetUrl = (req, filename) => {
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/${filename}`;
};

const updateProfileImage = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const profileImage = buildAssetUrl(req, req.file.filename);
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage },
      { new: true, select: '_id name email role profileImage phone' }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      message: 'Profile image updated',
      user: updatedUser
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getMyOrders = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const orders = await Order.find({ user: req.user.id })
      .populate('items.productId', 'title image')
      .sort({ createdAt: -1 })
      .lean();
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAddresses = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const list = await Address.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createAddress = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { name, phone, address, city, pincode } = req.body;
    if (!name || !phone || !address || !city || !pincode) {
      return res.status(400).json({ message: 'name, phone, address, city and pincode are required' });
    }
    const doc = await Address.create({
      user: req.user.id,
      name: String(name).trim(),
      phone: String(phone).trim(),
      address: String(address).trim(),
      city: String(city).trim(),
      pincode: String(pincode).trim()
    });
    return res.status(201).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateAddress = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { name, phone, address, city, pincode } = req.body;
    const existing = await Address.findOne({ _id: req.params.id, user: req.user.id });
    if (!existing) {
      return res.status(404).json({ message: 'Address not found' });
    }
    if (name !== undefined) existing.name = String(name).trim();
    if (phone !== undefined) existing.phone = String(phone).trim();
    if (address !== undefined) existing.address = String(address).trim();
    if (city !== undefined) existing.city = String(city).trim();
    if (pincode !== undefined) existing.pincode = String(pincode).trim();
    await existing.save();
    return res.json(existing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteAddress = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const result = await Address.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!result) {
      return res.status(404).json({ message: 'Address not found' });
    }
    return res.json({ message: 'Address deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { name, phone } = req.body;
    const update = {};
    if (name !== undefined && String(name).trim()) update.name = String(name).trim();
    if (phone !== undefined) update.phone = String(phone).trim();
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }
    const updatedUser = await User.findByIdAndUpdate(req.user.id, update, {
      new: true,
      select: '_id name email role profileImage phone'
    });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({ message: 'Profile updated', user: updatedUser });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.refreshTokens = [];
    await user.save();
    return res.json({ message: 'Password updated. Please log in again.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  updateProfileImage,
  getMyOrders,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  updateProfile,
  changePassword
};
