const Product = require('../models/Product');

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
  console.log('BASE_URL:', process.env.BASE_URL);
  console.log('Create product body:', req.body);

  try {
    const { name, category, description, variants } = req.body;
    const image = req.file
      ? `${process.env.BASE_URL}/uploads/${req.file.filename}`
      : undefined;

    const product = await Product.create({
      name,
      category,
      description,
      image,
      variants
    });

    res.status(201).json(product);
  } catch (error) {
    console.log('ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (req.file) {
      updates.image = `${process.env.BASE_URL}/uploads/${req.file.filename}`;
    }
    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
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