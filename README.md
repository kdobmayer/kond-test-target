# Inventory Management API

A RESTful inventory management API built with Express and better-sqlite3.

## Modules

- **Products** — CRUD operations for inventory products
- **Categories** — CRUD operations for product categories
- **Suppliers** — CRUD operations for suppliers
- **Stock** — Stock level tracking and adjustments
- **Reports** — Sales summaries and low-stock alerts
- **Auth** — API key validation middleware
- **Validation** — Shared input validators

## Cross-module flows

1. Stock adjustments update product quantity in the products table
2. Reports aggregate data across categories and products
3. Deleting a category reassigns products to "Uncategorized"

## Setup

```bash
npm install
npm start
```

Server runs on port 3000 (or `PORT` env var).

## Authentication

All endpoints require an `x-api-key` header. Valid keys are stored in the `api_keys` table.

## API Endpoints

### Products
- `GET /api/products` — List all products (supports `?category_id=` filter)
- `GET /api/products/:id` — Get product by ID
- `POST /api/products` — Create product
- `PUT /api/products/:id` — Update product
- `DELETE /api/products/:id` — Delete product

### Categories
- `GET /api/categories` — List all categories
- `GET /api/categories/:id` — Get category with product count
- `POST /api/categories` — Create category
- `PUT /api/categories/:id` — Update category
- `DELETE /api/categories/:id` — Delete category (reassigns products)

### Suppliers
- `GET /api/suppliers` — List all suppliers
- `GET /api/suppliers/:id` — Get supplier with products
- `POST /api/suppliers` — Create supplier (NO input validation — intentional)
- `PUT /api/suppliers/:id` — Update supplier
- `DELETE /api/suppliers/:id` — Delete supplier

### Stock
- `GET /api/stock` — List stock levels
- `GET /api/stock/:product_id/history` — Get adjustment history
- `POST /api/stock/adjust` — Adjust stock (NO validation — intentional)
- `PUT /api/stock/adjust` — Bulk adjust stock (NO validation — intentional)

### Reports
- `GET /api/reports/low-stock` — Products below reorder threshold
- `GET /api/reports/category-summary` — Stock value by category
- `GET /api/reports/supplier-summary` — Products and value by supplier
- `GET /api/reports/stock-movements` — Recent stock movements

## Scripts

- `npm start` — Start the server
- `npm test` — Run tests with coverage
- `npm run lint` — Lint source code

## Known issues

- POST /suppliers accepts any payload without validation
- PUT /stock/adjust accepts any payload without validation
- Error formatting is duplicated between products and categories controllers
- Reports module has no test coverage
