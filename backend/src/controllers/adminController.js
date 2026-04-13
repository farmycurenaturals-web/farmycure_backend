const Trade = require('../models/Trade');
const Contact = require('../models/Contact');

const getAdminTrades = async (_req, res) => {
  try {
    const trades = await Trade.find({}).sort({ createdAt: -1 });
    return res.json(trades);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAdminContacts = async (_req, res) => {
  try {
    const contacts = await Contact.find({}).sort({ createdAt: -1 });
    return res.json(contacts);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { getAdminTrades, getAdminContacts };
