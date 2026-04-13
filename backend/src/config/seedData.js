const Category = require('../models/Category');
const Product = require('../models/Product');

const categories = [
  {
    categoryCode: 'fruits',
    name: 'Fruits',
    slug: 'fruits',
    description: 'Fresh fruits, dehydrated flakes, and fine powders for daily nutrition.',
    image: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=600&h=400&fit=crop'
  },
  {
    categoryCode: 'vegetables',
    name: 'Vegetables',
    slug: 'vegetables',
    description: 'Farm-fresh vegetables and dehydrated flakes, naturally preserved.',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=400&fit=crop'
  },
  {
    categoryCode: 'grains',
    name: 'Grains',
    slug: 'grains',
    description: 'Premium quality grains sourced directly from trusted farms.',
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&h=400&fit=crop'
  },
  {
    categoryCode: 'nonVeg',
    name: 'Non-Veg',
    slug: 'non-veg',
    description: 'Dehydrated meats and eggs, preserved naturally for lasting freshness.',
    image: 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=600&h=400&fit=crop'
  }
];

const products = [
  {
    productCode: 'banana',
    title: 'Banana',
    name: 'Banana',
    category: 'fruits',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=400&fit=crop',
    variants: {
      fresh: { '1kg': 60, '5kg': 280, '10kg': 520 },
      flakes: { '0.5kg': 120, '1kg': 220, '5kg': 950 },
      powder: { '200g': 90, '500g': 180, '1kg': 350 }
    }
  },
  {
    productCode: 'mango',
    title: 'Mango',
    name: 'Mango',
    category: 'fruits',
    image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&h=400&fit=crop',
    variants: {
      fresh: { '1kg': 120, '5kg': 550, '10kg': 1000 },
      flakes: { '0.5kg': 150, '1kg': 280, '5kg': 1200 },
      powder: { '200g': 180, '500g': 400, '1kg': 750 }
    }
  },
  {
    productCode: 'rice',
    title: 'Rice',
    name: 'Rice',
    category: 'grains',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop',
    variants: {
      basmati: { '1kg': 70, '5kg': 320, '10kg': 600 },
      kala_namak: { '1kg': 90, '5kg': 420, '10kg': 800 }
    }
  },
  {
    productCode: 'chicken',
    title: 'Chicken',
    name: 'Chicken',
    category: 'nonVeg',
    image: 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=400&h=400&fit=crop',
    variants: { '0.5kg': 450, '1kg': 850, '5kg': 3900 }
  }
];

const seedDataIfEmpty = async () => {
  const categoriesCount = await Category.countDocuments();
  if (!categoriesCount) {
    await Category.insertMany(categories);
  }
  const productsCount = await Product.countDocuments();
  if (!productsCount) {
    await Product.insertMany(products);
  }
};

module.exports = { seedDataIfEmpty };
