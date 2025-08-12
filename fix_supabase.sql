-- ============================================================
-- SimpliBiz Supabase Fix Script
-- ============================================================
-- This script contains SQL commands to fix common issues with
-- the SimpliBiz database configuration in Supabase.
-- Run these commands in your Supabase SQL Editor.
-- ============================================================

-- IMPORTANT: RUN THE ENTIRE SCRIPT AT ONCE
-- The script must be run completely to fix all issues

-- 1. Fix database schema issues
-- ------------------------------------------------------------
-- Remove category_id from products table if it exists
-- First remove any foreign key constraint
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
-- Then remove the column itself
ALTER TABLE public.products DROP COLUMN IF EXISTS category_id;

-- Add timestamp columns if they don't exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Fix the ID column to auto-increment if needed
DO $$ 
DECLARE
    is_identity BOOLEAN;
BEGIN
    -- Check if the ID column is an identity column
    SELECT EXISTS (
        SELECT 1 FROM pg_attribute 
        JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
        JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
        WHERE pg_namespace.nspname = 'public'
        AND pg_class.relname = 'products'
        AND pg_attribute.attname = 'id'
        AND pg_attribute.attidentity != ''
    ) INTO is_identity;
    
    -- Only fix if not an identity column
    IF NOT is_identity THEN
        -- Check if column has a default value (sequence)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'products'
            AND column_name = 'id'
            AND column_default IS NULL
        ) THEN
            RAISE NOTICE 'Setting up auto-increment for products.id';
            -- Create a sequence if it doesn't exist
            CREATE SEQUENCE IF NOT EXISTS products_id_seq;
            -- Set the sequence as the default for the id column
            ALTER TABLE public.products ALTER COLUMN id SET DEFAULT nextval('products_id_seq');
            -- Set the sequence to the max id value + 1
            PERFORM setval('products_id_seq', COALESCE((SELECT MAX(id) FROM public.products), 0) + 1);
        END IF;
    ELSE
        RAISE NOTICE 'products.id is already an identity column - no changes needed';
    END IF;
END $$;

-- Create a trigger to update the updated_at column automatically
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON public.products;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- 2. Ensure RLS is enabled on all tables
-- ------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- 3. Create necessary RLS policies
-- ------------------------------------------------------------
-- Policy for products table - allows authenticated users to perform all operations
-- First drop existing policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "Users can view their own products" ON public.products;
DROP POLICY IF EXISTS "Users can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;

-- Create policies
CREATE POLICY "Users can view their own products" 
ON public.products FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own products" 
ON public.products FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products" 
ON public.products FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products" 
ON public.products FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Storage Bucket and Policies
-- ------------------------------------------------------------
-- First, ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Next, set up storage policies
-- First drop existing storage policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "Allow authenticated user uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own objects" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own objects" ON storage.objects;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Allow authenticated user uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their own objects
CREATE POLICY "Allow users to update their own objects"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own objects
CREATE POLICY "Allow users to delete their own objects"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to product images
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- 5. Verification Queries
-- ------------------------------------------------------------
-- Check if category_id has been removed
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'category_id';
-- If this returns no rows, the column has been removed successfully

-- Check if RLS is enabled on products table
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'products';
-- relrowsecurity should be true

-- Check policies on products table
SELECT tablename, policyname, cmd, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'products';
-- Should see your policies listed here
