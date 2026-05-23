const express = require('express');
const router = express.Router();
const products = require('../controllers/products');
const categories = require('../controllers/categories');
const suppliers = require('../controllers/suppliers');
const stock = require('../controllers/stock');
const reports = require('../controllers/reports');

// Products
router.get('/products', products.listProducts);
router.get('/products/export', products.exportProducts);
router.get('/products/:id', products.getProduct);
router.post('/products', products.createProduct);
router.put('/products/:id', products.updateProduct);
router.delete('/products/:id', products.deleteProduct);

// Categories
router.get('/categories', categories.listCategories);
router.get('/categories/:id', categories.getCategory);
router.post('/categories', categories.createCategory);
router.put('/categories/:id', categories.updateCategory);
router.delete('/categories/:id', categories.deleteCategory);

// Suppliers
router.get('/suppliers', suppliers.listSuppliers);
router.get('/suppliers/:id', suppliers.getSupplier);
router.post('/suppliers', suppliers.createSupplier);
router.put('/suppliers/:id', suppliers.updateSupplier);
router.delete('/suppliers/:id', suppliers.deleteSupplier);

// Stock
router.get('/stock', stock.listStock);
router.get('/stock/:product_id/history', stock.getStockHistory);
router.post('/stock/adjust', stock.adjustStock);
router.put('/stock/adjust', stock.bulkAdjustStock);

// Reports
router.get('/reports/low-stock', reports.lowStock);
router.get('/reports/category-summary', reports.categorySummary);
router.get('/reports/supplier-summary', reports.supplierSummary);
router.get('/reports/stock-movements', reports.stockMovements);

module.exports = router;
