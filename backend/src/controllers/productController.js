const Product = require('../models/Product');

const toBool = (value) => String(value).toLowerCase() === 'true';
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeParseJson = (value, fallback = null) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const buildFileMap = (files = []) =>
  files.reduce((acc, file) => {
    acc[file.fieldname] = file;
    return acc;
  }, {});

const resolveUploadedPath = (file) =>
  file ? `${process.env.BASE_URL || ''}/uploads/${file.filename}`.replace(/(?<!:)\/\/+/g, '/') : '';

const normalizeVariants = (rawVariants, filesMap) => {
  const parsedVariants = Array.isArray(rawVariants) ? rawVariants : [];
  return parsedVariants
    .map((variant, index) => {
      const name = String(variant?.name || variant?.variantName || `variant-${index + 1}`).trim();
      const uploadKey = String(variant?.imageFileKey || '').trim();
      const uploadedImage = resolveUploadedPath(filesMap[uploadKey]);
      const providedImage = String(variant?.image || '').trim();

      const optionSource = Array.isArray(variant?.options) ? variant.options : [];
      const options = optionSource
        .map((option) => ({
          quantity: String(option?.quantity || '').trim(),
          price: toNumber(option?.price, NaN),
          stock: Math.max(0, toNumber(option?.stock, 0)),
        }))
        .filter((option) => option.quantity && Number.isFinite(option.price));

      if (!options.length && variant?.quantity && Number.isFinite(Number(variant?.price))) {
        options.push({
          quantity: String(variant.quantity).trim(),
          price: toNumber(variant.price, 0),
          stock: Math.max(0, toNumber(variant.stock, 0)),
        });
      }

      if (!name || !options.length) return null;

      return {
        name,
        image: uploadedImage || providedImage,
        options,
        // Backward compatibility values
        variantName: name,
        price: options[0]?.price ?? 0,
        stock: options.reduce((sum, option) => sum + (option.stock || 0), 0),
        quantityOptions: options.map((option) => option.quantity),
      };
    })
    .filter(Boolean);
};

const derivePriceAndStock = (variants = []) => {
  const allOptions = variants.flatMap((variant) => variant.options || []);
  if (!allOptions.length) return { price: 0, stock: 0 };

  const prices = allOptions.map((option) => toNumber(option.price, NaN)).filter(Number.isFinite);
  const stock = allOptions.reduce((sum, option) => sum + Math.max(0, toNumber(option.stock, 0)), 0);
  return {
    price: prices.length ? Math.min(...prices) : 0,
    stock,
  };
};

const getProducts = async (req, res) => {
  try {
    const filter = req.query.category ? { category: req.query.category } : {};
    const products = await Product.find(filter);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFeaturedProducts = async (req, res) => {
  try {
    const limit = Math.max(1, Number(req.query.limit) || 8);
    const products = await Product.find({}).sort({ _id: -1 }).limit(limit);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const filesMap = buildFileMap(req.files);
    const rawVariants = safeParseJson(req.body.variants, []);
    const variants = normalizeVariants(rawVariants, filesMap);
    const { price, stock } = derivePriceAndStock(variants);

    const name = String(req.body.name || req.body.title || '').trim();
    const category = String(req.body.category || '').trim();
    const description = String(req.body.description || '').trim();
    const isFeatured = toBool(req.body.isFeatured);
    const image = String(req.body.image || variants[0]?.image || '').trim();

    if (!name) return res.status(400).json({ message: 'Product name is required' });
    if (!category) return res.status(400).json({ message: 'Product category is required' });
    if (!variants.length) return res.status(400).json({ message: 'At least one valid variant is required' });

    const product = await Product.create({
      name,
      title: name,
      category,
      description,
      image,
      isFeatured,
      price,
      stock,
      variants,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const filesMap = buildFileMap(req.files);
    const hasVariants = typeof req.body.variants !== 'undefined';
    const normalizedVariants = hasVariants
      ? normalizeVariants(safeParseJson(req.body.variants, []), filesMap)
      : product.variants;
    const { price, stock } = derivePriceAndStock(normalizedVariants);

    const nextName = req.body.name ? String(req.body.name).trim() : product.name;
    const nextCategory = req.body.category ? String(req.body.category).trim() : product.category;

    if (!nextName) return res.status(400).json({ message: 'Product name is required' });
    if (!nextCategory) return res.status(400).json({ message: 'Product category is required' });
    if (!normalizedVariants.length) {
      return res.status(400).json({ message: 'At least one valid variant is required' });
    }

    product.name = nextName;
    product.title = nextName;
    product.category = nextCategory;
    product.description =
      req.body.description !== undefined ? String(req.body.description || '').trim() : product.description;
    product.isFeatured =
      req.body.isFeatured !== undefined ? toBool(req.body.isFeatured) : Boolean(product.isFeatured);
    product.variants = normalizedVariants;
    product.price = price;
    product.stock = stock;
    product.image = req.body.image !== undefined
      ? String(req.body.image || normalizedVariants[0]?.image || '').trim()
      : (product.image || normalizedVariants[0]?.image || '');

    await product.save();
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getFeaturedProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};