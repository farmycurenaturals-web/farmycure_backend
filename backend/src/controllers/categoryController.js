const Category = require('../models/Category');

const buildAssetUrl = (req, filename) => {
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/${filename}`;
};

const getCategories = async (_req, res) => {
  try {
    const categories = await Category.find({}).sort({ createdAt: 1 });
    return res.json(categories);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, slug, description, image, imageUrl, categoryCode } = req.body;
    const resolvedImage =
      req.file?.filename ? buildAssetUrl(req, req.file.filename) : String(imageUrl || image || '').trim();

    if (!name || !slug || !categoryCode) {
      return res.status(400).json({ message: 'name, slug and categoryCode are required' });
    }
    if (!resolvedImage) {
      return res.status(400).json({ message: 'Provide a category image file or imageUrl' });
    }

    const category = await Category.create({
      name,
      slug,
      description,
      image: resolvedImage,
      categoryCode
    });
    return res.status(201).json(category);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { getCategories, createCategory };
