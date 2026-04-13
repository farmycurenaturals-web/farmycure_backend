const Product = require('../models/Product');

const buildAssetUrl = (req, filename) => {
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/${filename}`;
};

const safeJsonParse = (value, fallback) => {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeVariants = (rawVariants = []) => {
  if (!Array.isArray(rawVariants)) return [];
  return rawVariants
    .map((variant) => {
      const options = Array.isArray(variant?.options)
        ? variant.options
            .map((opt) => ({
              quantity: String(opt?.quantity || '').trim(),
              price: Number(opt?.price),
              stock: Number(opt?.stock || 0)
            }))
            .filter((opt) => opt.quantity && Number.isFinite(opt.price))
        : [];
      return {
        name: String(variant?.name || '').trim(),
        image: String(variant?.image || '').trim(),
        imageFileKey: String(variant?.imageFileKey || '').trim(),
        options
      };
    })
    .filter((variant) => variant.name && variant.options.length > 0);
};

const parseFeatured = (body) =>
  body.isFeatured === true ||
  body.isFeatured === 'true' ||
  String(body.isFeatured || '').toLowerCase() === 'true';

const normalizeProductPayload = (body) => {
  const title = String(body.title || body.name || '').trim();
  const variantsInput = safeJsonParse(body.variants, []);
  const variants = normalizeVariants(variantsInput);
  const minPrice = variants.length
    ? Math.min(...variants.flatMap((variant) => variant.options.map((opt) => opt.price)))
    : Number(body.price || 0);
  const totalStock = variants.length
    ? variants.flatMap((variant) => variant.options).reduce((sum, opt) => sum + (Number(opt.stock) || 0), 0)
    : Number(body.stock || 0);

  return {
    productCode: body.productCode,
    title,
    name: body.name || title,
    category: body.category,
    description: body.description,
    image: String(body.image || '').trim(),
    variants,
    price: Number.isFinite(minPrice) ? minPrice : 0,
    stock: Number.isFinite(totalStock) ? totalStock : 0,
    isActive: body.isActive !== false,
    isFeatured: parseFeatured(body)
  };
};

const getProducts = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    const products = await Product.find(filter).sort({ createdAt: -1 });
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getFeaturedProducts = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 24);
    const products = await Product.find({ isFeatured: true, isActive: true })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit);
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id) || await Product.findOne({ productCode: req.params.id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.json(product);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body);
    const files = Array.isArray(req.files) ? req.files : [];
    const fileUrlMap = new Map(files.map((file) => [file.fieldname, buildAssetUrl(req, file.filename)]));
    payload.variants = (payload.variants || []).map((variant) => ({
      name: variant.name,
      image: variant.imageFileKey && fileUrlMap.has(variant.imageFileKey) ? fileUrlMap.get(variant.imageFileKey) : variant.image,
      options: variant.options
    }));
    const product = await Product.create(payload);
    return res.status(201).json(product);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body);
    const files = Array.isArray(req.files) ? req.files : [];
    const fileUrlMap = new Map(files.map((file) => [file.fieldname, buildAssetUrl(req, file.filename)]));
    payload.variants = (payload.variants || []).map((variant) => ({
      name: variant.name,
      image: variant.imageFileKey && fileUrlMap.has(variant.imageFileKey) ? fileUrlMap.get(variant.imageFileKey) : variant.image,
      options: variant.options
    }));
    const product = await Product.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.json(product);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getFeaturedProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};