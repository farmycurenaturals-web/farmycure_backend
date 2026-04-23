const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Order = require('../models/Order');
const Address = require('../models/Address');

const sanitizeAddressPayload = (body = {}) => ({
  name: String(body.name || '').trim(),
  phone: String(body.phone || '').trim(),
  address: String(body.address || '').trim(),
  city: String(body.city || '').trim(),
  state: String(body.state || '').trim(),
  pincode: String(body.pincode || '').trim(),
});

const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).populate('items.productId').sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user.id }).sort({ isDefault: -1, createdAt: -1 });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createAddress = async (req, res) => {
  try {
    const payload = sanitizeAddressPayload(req.body);
    const missingField = Object.entries(payload).find(([, value]) => !value)?.[0];
    if (missingField) {
      return res.status(400).json({ message: `${missingField} is required` });
    }

    const userId = req.user.id;
    const hasExisting = (await Address.countDocuments({ user: userId })) > 0;
    const isDefault = req.body.isDefault === true || !hasExisting;

    if (isDefault) {
      await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    const address = await Address.create({
      user: userId,
      ...payload,
      isDefault,
    });

    return res.status(201).json(address);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateAddress = async (req, res) => {
  try {
    const payload = sanitizeAddressPayload(req.body);
    const missingField = Object.entries(payload).find(([, value]) => !value)?.[0];
    if (missingField) {
      return res.status(400).json({ message: `${missingField} is required` });
    }

    const existing = await Address.findOne({ _id: req.params.id, user: req.user.id });
    if (!existing) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const shouldSetDefault = req.body.isDefault === true;
    if (shouldSetDefault) {
      await Address.updateMany({ user: req.user.id }, { $set: { isDefault: false } });
      existing.isDefault = true;
    }

    existing.name = payload.name;
    existing.phone = payload.phone;
    existing.address = payload.address;
    existing.city = payload.city;
    existing.state = payload.state;
    existing.pincode = payload.pincode;
    await existing.save();

    return res.json(existing);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const deleted = await Address.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!deleted) {
      return res.status(404).json({ message: 'Address not found' });
    }

    if (deleted.isDefault) {
      const fallback = await Address.findOne({ user: req.user.id }).sort({ createdAt: -1 });
      if (fallback) {
        fallback.isDefault = true;
        await fallback.save();
      }
    }

    return res.json({ message: 'Address deleted', _id: req.params.id });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) {
      const n = String(req.body.name).trim();
      if (n) updates.name = n;
    }
    if (req.body.email !== undefined) {
      updates.email = String(req.body.email).trim().toLowerCase();
    }
    if (req.body.phone !== undefined) {
      updates.phone = String(req.body.phone).trim();
    }

    if (Object.keys(updates).length === 0) {
      const user = await User.findById(req.user.id).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json(user);
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
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
  try {
    const image = req.file ? `${process.env.BASE_URL}/uploads/${req.file.filename}` : null;
    if (!image) {
      return res.status(400).json({ message: 'Image file is required' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: image },
      { new: true }
    ).select('-password');
    res.json({ image, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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
