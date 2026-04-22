const Address = require('../models/Address');

const sanitizeAddressPayload = (body = {}) => ({
  name: String(body.name || '').trim(),
  phone: String(body.phone || '').trim(),
  address: String(body.address || '').trim(),
  city: String(body.city || '').trim(),
  state: String(body.state || '').trim(),
  pincode: String(body.pincode || '').trim(),
});

const saveAddress = async (req, res) => {
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

const getAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user.id }).sort({ isDefault: -1, createdAt: -1 });
    return res.json(addresses);
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
      const nextAddress = await Address.findOne({ user: req.user.id }).sort({ createdAt: -1 });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    return res.json({ message: 'Address deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user.id });
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    await Address.updateMany({ user: req.user.id }, { $set: { isDefault: false } });
    address.isDefault = true;
    await address.save();

    return res.json(address);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  saveAddress,
  getAddresses,
  deleteAddress,
  setDefaultAddress,
};
