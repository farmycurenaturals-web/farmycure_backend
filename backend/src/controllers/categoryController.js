const Category = require('../models/Category');

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name) return res.status(400).json({ message: 'Category name is required' });

    const normalizedSlug =
      slug ||
      String(name)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');

    const category = await Category.create({ name, slug: normalizedSlug });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getCategories, createCategory };
