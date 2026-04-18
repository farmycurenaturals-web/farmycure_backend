require('dotenv').config({ override: true });
const dns = require('dns');
const mongoose = require('mongoose');
const Product = require('../models/Product');

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCategoryValue = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const normalizeImageHost = (value = '') => {
  const image = String(value || '').trim();
  if (!image) return '';
  if (!process.env.BASE_URL) return image;
  return image.replace(/^https?:\/\/localhost:5000/i, process.env.BASE_URL);
};

const derivePriceAndStock = (variants = []) => {
  const allOptions = variants.flatMap((variant) => variant.options || []);
  const prices = allOptions.map((option) => toNumber(option.price, NaN)).filter(Number.isFinite);
  const stock = allOptions.reduce((sum, option) => sum + Math.max(0, toNumber(option.stock, 0)), 0);
  return {
    price: prices.length ? Math.min(...prices) : 0,
    stock,
  };
};

const normalizeVariantsFromAnyShape = (rawVariants = []) => {
  if (!Array.isArray(rawVariants)) return [];

  return rawVariants
    .map((variant, index) => {
      const name = String(variant?.name || variant?.variantName || `variant-${index + 1}`).trim();
      const options = [];

      if (Array.isArray(variant?.options) && variant.options.length) {
        for (const option of variant.options) {
          const quantity = String(option?.quantity || '').trim();
          const price = toNumber(option?.price, NaN);
          const stock = Math.max(0, toNumber(option?.stock, 0));
          if (!quantity || !Number.isFinite(price)) continue;
          options.push({ quantity, price, stock });
        }
      } else if (Array.isArray(variant?.quantityOptions) && Number.isFinite(Number(variant?.price))) {
        const basePrice = toNumber(variant.price, 0);
        const baseStock = Math.max(0, toNumber(variant.stock, 0));
        for (const quantityRaw of variant.quantityOptions) {
          const quantity = String(quantityRaw || '').trim();
          if (!quantity) continue;
          options.push({ quantity, price: basePrice, stock: baseStock });
        }
      } else if (variant?.quantity && Number.isFinite(Number(variant?.price))) {
        options.push({
          quantity: String(variant.quantity).trim(),
          price: toNumber(variant.price, 0),
          stock: Math.max(0, toNumber(variant.stock, 0)),
        });
      }

      if (!name || !options.length) return null;

      return {
        name,
        image: normalizeImageHost(variant?.image || ''),
        options,
        variantName: name,
        price: options[0]?.price ?? 0,
        stock: options.reduce((sum, option) => sum + (option.stock || 0), 0),
        quantityOptions: options.map((option) => option.quantity),
      };
    })
    .filter(Boolean);
};

const normalizeProduct = (product) => {
  const plain = product.toObject();
  const variants = normalizeVariantsFromAnyShape(plain.variants);
  const { price, stock } = derivePriceAndStock(variants);
  const name = String(plain.name || plain.title || '').trim();
  const category = normalizeCategoryValue(plain.category || '');
  const image = normalizeImageHost(plain.image || variants[0]?.image || '');

  return {
    name,
    title: name,
    category: category || String(plain.category || '').trim(),
    image,
    variants,
    price,
    stock,
    isFeatured: Boolean(plain.isFeatured),
  };
};

const run = async () => {
  const dnsServers = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (dnsServers.length) {
    try {
      dns.setServers(dnsServers);
    } catch {}
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    family: 4,
  });

  const products = await Product.find({});
  let updated = 0;

  for (const product of products) {
    const normalized = normalizeProduct(product);
    const before = JSON.stringify({
      name: product.name,
      title: product.title,
      category: product.category,
      image: product.image,
      variants: product.variants,
      price: product.price,
      stock: product.stock,
      isFeatured: product.isFeatured,
    });
    const after = JSON.stringify(normalized);

    if (before !== after) {
      await Product.updateOne({ _id: product._id }, normalized);
      updated += 1;
    }
  }

  console.log(`Products scanned: ${products.length}`);
  console.log(`Products updated: ${updated}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Migration failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
