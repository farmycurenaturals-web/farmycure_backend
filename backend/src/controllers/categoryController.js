const Category = require('../models/Category');
const Product = require('../models/Product');

const normalizeSlug = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const normalizeImageHost = (value = '') => {
  const image = String(value || '').trim();
  if (!image) return '';
  if (!process.env.BASE_URL) return image;
  return image
    .replace(/^https?:\/\/localhost:5000/i, process.env.BASE_URL)
    .replace(/^https?:\/\/api\.farmycure\.com/i, process.env.BASE_URL);
};

const normalizeCategoryDocument = (cat) => {
  const plain = typeof cat?.toObject === 'function' ? cat.toObject() : { ...(cat || {}) };
  return {
    ...plain,
    image: normalizeImageHost(plain.image || ''),
  };
};

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ createdAt: -1 });
    res.json(categories.map(normalizeCategoryDocument));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, slug, categoryCode, description, imageUrl } = req.body;
    if (!name) return res.status(400).json({ message: 'Category name is required' });

    const normalizedSlug = normalizeSlug(slug || name);
    if (!normalizedSlug) {
      return res.status(400).json({ message: 'Invalid category slug' });
    }

    const existing = await Category.findOne({ slug: normalizedSlug });
    if (existing) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    const image = req.file
      ? `${process.env.BASE_URL || ''}/uploads/${req.file.filename}`.replace(/(?<!:)\/\/+/g, '/')
      : String(imageUrl || '').trim();

    const category = await Category.create({
      name: String(name).trim(),
      slug: normalizedSlug,
      categoryCode: normalizeSlug(categoryCode || normalizedSlug),
      description: String(description || '').trim(),
      image,
    });
    res.status(201).json(normalizeCategoryDocument(category));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const nextName = req.body.name ? String(req.body.name).trim() : category.name;
    const nextSlug = normalizeSlug(req.body.slug || req.body.categoryCode || nextName || category.slug);
    if (!nextName || !nextSlug) {
      return res.status(400).json({ message: 'Category name and slug are required' });
    }

    const duplicate = await Category.findOne({ slug: nextSlug, _id: { $ne: category._id } });
    if (duplicate) {
      return res.status(400).json({ message: 'Another category already uses this slug' });
    }

    const image = req.file
      ? `${process.env.BASE_URL || ''}/uploads/${req.file.filename}`.replace(/(?<!:)\/\/+/g, '/')
      : req.body.imageUrl !== undefined
        ? String(req.body.imageUrl || '').trim()
        : category.image;

    category.name = nextName;
    category.slug = nextSlug;
    category.categoryCode = normalizeSlug(req.body.categoryCode || nextSlug);
    category.description = String(req.body.description || '').trim();
    category.image = image;
    await category.save();

    res.json(normalizeCategoryDocument(category));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const productsCount = await Product.countDocuments({
      category: { $in: [category.slug, category.categoryCode, category.name] },
    });
    if (productsCount > 0) {
      return res.status(400).json({ message: 'Cannot delete category with linked products' });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
