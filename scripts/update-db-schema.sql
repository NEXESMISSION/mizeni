-- Script to update the database schema by removing category-related columns

-- 1. First remove the foreign key constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey;

-- 2. Remove the category_id column from the products table
ALTER TABLE products DROP COLUMN IF EXISTS category_id;

-- Note: You can run this script in the Supabase SQL Editor
-- You can leave the categories table in place for now if other parts of the
-- application still reference it, or drop it if it's no longer needed
-- DROP TABLE IF EXISTS categories;
