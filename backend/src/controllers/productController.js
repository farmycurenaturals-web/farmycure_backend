const Product = require('../models/Product');

const getProducts = async (req, res) => {
  try {
    const products = await Product.find({});
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
  console.log("BASE_URL:", process.env.BASE_URL); // 👈 ADD THIS LINE

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
    console.log("ERROR:", error.message); // 👈 ALSO ADD THIS (very important)
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getProducts, getProductById, createProduct };