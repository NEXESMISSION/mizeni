import { createClient } from '@supabase/supabase-js';

// These environment variables need to be set in a .env file
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Product interface to be used across the application
export interface Product {
  id?: number;
  name: string;
  image_url: string;
  selling_price: number;
  cost_price: number;
  stock: number;
  low_stock_threshold: number;
  created_at?: string;
  user_id?: string;
  updated_at?: string;
}

// Helper functions for database operations
export const getProducts = async (userId: string): Promise<Product[]> => {
  try {
    // Modified to not include updated_at until database is fixed
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        image_url,
        selling_price,
        cost_price,
        stock,
        low_stock_threshold,
        created_at
      `)
      .eq('user_id', userId);
    
    if (error) throw error;
    // Add a default updated_at value since the schema expects it
    return (data || []).map(product => ({
      ...product,
      updated_at: product.created_at || new Date().toISOString()
    })) as Product[];
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
};

// Categories have been removed from the application

export const getSales = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        total_cost,
        created_at,
        sale_items (
          id,
          product_id,
          quantity,
          price_at_sale,
          cost_at_sale
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching sales:', error);
    return [];
  }
};

// Category functions have been removed from the application

export const createProduct = async (product: Omit<Product, 'id'|'created_at'>, userId: string): Promise<Product> => {
  // Validate inputs
  if (!userId) {
    console.error('createProduct: User ID is required');
    throw new Error('User ID is required');
  }

  if (!product.name || product.name.trim() === '') {
    console.error('createProduct: Product name is required');
    throw new Error('Product name is required');
  }

  if (isNaN(product.selling_price) || product.selling_price <= 0) {
    console.error('createProduct: Invalid selling price', product.selling_price);
    throw new Error('Selling price must be a positive number');
  }

  try {
    console.log(`Creating product "${product.name}" for user ${userId}`);
    
    // Generate a unique ID for the product
    const timestamp = Date.now();
    const randomPart = Math.floor(Math.random() * 10000);
    const generatedId = timestamp * 100 + randomPart;
    
    // Ensure product has all required fields
    const productToInsert = {
      ...product,
      id: generatedId, // Add explicit ID
      user_id: userId,
      cost_price: product.cost_price || 0,
      stock: product.stock || 0,
      low_stock_threshold: product.low_stock_threshold || 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString() // Add updated_at as well
    };

    const { data, error } = await supabase
      .from('products')
      .insert([productToInsert])
      .select();
      
    if (error) {
      console.error('Database error creating product:', error);
      // Check for specific error types
      if (error.code === '23505') { // Duplicate key violation
        throw new Error(`A product with this name already exists: ${error.message}`);
      } else if (error.code === '42501' || error.message?.includes('permission')) {
        throw new Error(`Permission denied: ${error.message}. Please check RLS policies.`);
      } else {
        throw error;
      }
    }
    
    if (!data || data.length === 0) {
      console.error('No data returned after creating product');
      throw new Error('Failed to create product. No data returned from database.');
    }
    
    console.log('Product created successfully:', data[0].id);
    return data[0] as Product;
  } catch (error: any) {
    console.error('Error creating product:', error);
    throw new Error(`Failed to create product: ${error.message || 'Unknown error'}`);
  }
};

export const updateProduct = async (productId: number, updates: Partial<Product>): Promise<Product> => {
  // Validate inputs
  if (!productId || isNaN(Number(productId))) {
    console.error('updateProduct: Invalid product ID', productId);
    throw new Error('Valid product ID is required');
  }
  
  if (updates.name && updates.name.trim() === '') {
    console.error('updateProduct: Product name cannot be empty');
    throw new Error('Product name cannot be empty');
  }
  
  if (updates.selling_price !== undefined && (isNaN(updates.selling_price) || updates.selling_price <= 0)) {
    console.error('updateProduct: Invalid selling price', updates.selling_price);
    throw new Error('Selling price must be a positive number');
  }

  try {
    console.log(`Updating product ID ${productId} with:`, updates);
    
    // Always update the updated_at timestamp
    const updatesToApply = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    // First check if the product exists and belongs to the user
    const { data: existingProduct, error: checkError } = await supabase
      .from('products')
      .select('id, user_id')
      .eq('id', productId)
      .single();
    
    if (checkError) {
      console.error('Error checking product existence:', checkError);
      if (checkError.code === '42501' || checkError.message?.includes('permission')) {
        throw new Error(`Permission denied: ${checkError.message}. Please check RLS policies.`);
      } else {
        throw new Error(`Failed to verify product: ${checkError.message}`);
      }
    }
    
    if (!existingProduct) {
      console.error(`Product ID ${productId} not found`);
      throw new Error(`Product with ID ${productId} not found`);
    }
    
    // Now perform the update
    const { data, error } = await supabase
      .from('products')
      .update(updatesToApply)
      .eq('id', productId)
      .select();
      
    if (error) {
      console.error('Database error updating product:', error);
      if (error.code === '23505') { // Duplicate key violation
        throw new Error(`A product with this name already exists: ${error.message}`);
      } else if (error.code === '42501' || error.message?.includes('permission')) {
        throw new Error(`Permission denied: ${error.message}. Please check RLS policies.`);
      } else {
        throw error;
      }
    }
    
    if (!data || data.length === 0) {
      console.error(`No data returned after updating product ID ${productId}`);
      throw new Error('Failed to update product. No data returned from database.');
    }
    
    console.log('Product updated successfully:', data[0].id);
    return data[0] as Product;
  } catch (error: any) {
    console.error(`Error updating product ID ${productId}:`, error);
    throw new Error(`Failed to update product: ${error.message || 'Unknown error'}`);
  }
};

export const deleteProduct = async (productId: number) => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

export const deleteSales = async (userId: string) => {
  try {
    // First get all sales for this user
    const { data: sales, error: fetchError } = await supabase
      .from('sales')
      .select('id')
      .eq('user_id', userId);
    
    if (fetchError) throw fetchError;
    
    // If no sales, return early
    if (!sales || sales.length === 0) return true;
    
    // Get all sale_ids
    const saleIds = sales.map(sale => sale.id);
    
    // Delete related sale_items first
    const { error: itemsError } = await supabase
      .from('sale_items')
      .delete()
      .in('sale_id', saleIds);
    
    if (itemsError) throw itemsError;
    
    // Then delete the sales
    const { error: salesError } = await supabase
      .from('sales')
      .delete()
      .in('id', saleIds);
    
    if (salesError) throw salesError;
    
    return true;
  } catch (error) {
    console.error('Error deleting sales history:', error);
    throw error;
  }
};

export const createSale = async (userId: string, saleItems: any[], total: number, cost: number) => {
  try {
    // First create the sale record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{
        user_id: userId,
        total_amount: total,
        total_cost: cost
      }])
      .select();
      
    if (saleError) throw saleError;
    
    // Then create all the sale items
    const saleId = sale[0].id;
    const saleItemsWithSaleId = saleItems.map(item => ({ 
      ...item, 
      sale_id: saleId 
    }));
    
    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItemsWithSaleId);
      
    if (itemsError) throw itemsError;
    
    // Update product stock quantities
    console.log('Updating product quantities after sale...');
    
    // Process each sale item to decrease stock
    for (const item of saleItems) {
      const productId = item.product_id;
      const quantity = item.quantity;
      
      // Get the current product
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock')
        .eq('id', productId)
        .single();
      
      if (productError) {
        console.error(`Error fetching product ${productId}:`, productError);
        continue; // Skip to the next item if we can't fetch this one
      }
      
      // Calculate new stock quantity
      const newStock = Math.max(0, product.stock - quantity); // Ensure stock doesn't go negative
      
      // Update the product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);
      
      if (updateError) {
        console.error(`Error updating stock for product ${productId}:`, updateError);
      } else {
        console.log(`Updated stock for product ${productId} from ${product.stock} to ${newStock}`);
      }
    }
    
    return sale[0];
  } catch (error) {
    console.error('Error creating sale:', error);
    throw error;
  }
};

/**
 * Returns a placeholder image URL for when an image can't be uploaded
 * @param filename The name of the file that couldn't be uploaded
 * @returns A placeholder image URL
 */
export const getPlaceholderImageUrl = (filename: string): string => {
  // Extract file extension if present
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  // Define the placeholder text based on file type
  let placeholderText = 'Product+Image';
  
  // Set colors based on file type
  let bgColor = 'e2e8f0';
  let textColor = '64748b';
  
  // Construct the placeholder URL
  return `https://placehold.co/300x300/${bgColor}/${textColor}?text=${placeholderText}`;
};

export const uploadProductImage = async (userId: string, file: File): Promise<string> => {
  const bucketName = 'product-images';
  let retryCount = 0;
  const maxRetries = 2;
  
  const uploadWithRetry = async (): Promise<string> => {
    try {
      // Validate inputs
      if (!userId) throw new Error('User ID is required for image upload');
      if (!file) throw new Error('File is required for image upload');
      
      console.log(`Attempting to upload image for user ${userId} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      // Check file size (5MB limit)
      if (file.size > 5242880) {
        throw new Error('File size exceeds 5MB limit');
      }
      
      // Instead of checking if bucket exists first (which may fail due to permissions),
      // let's just try to upload and handle errors appropriately
      console.log('Attempting to upload to bucket:', bucketName);
      
      try {
        // First try to get bucket info to check if it exists
        // This will verify permissions and bucket existence
        const { data: bucketInfo, error } = await supabase.storage.getBucket(bucketName);
        
        if (error) {
          console.warn(`Cannot get info for bucket '${bucketName}':`, error.message);
          console.warn('Will attempt upload anyway - if bucket exists, this might work');
        } else {
          console.log(`Bucket '${bucketName}' found:`, bucketInfo);
        }
      } catch (bucketError) {
        // If getBucket fails, log the error but continue with upload attempt
        console.warn(`Error checking bucket '${bucketName}':`, bucketError);
        console.warn('Will attempt upload anyway - if bucket exists, this might work');
      }
      
      // Create a unique file name with proper folder structure
      const fileExt = file.name.split('.').pop() || 'jpg';
      const randomId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const fileName = `${userId}/${randomId}.${fileExt}`;
      
      console.log('Uploading file to path:', fileName);
      
      try {
        // Upload the file - use upsert: true to overwrite if file exists
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          console.warn('Returning placeholder image due to upload failure');
          return getPlaceholderImageUrl(file.name);
        }
        
        console.log('File uploaded successfully');
        
        // Get the public URL
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);
          
        if (!urlData || !urlData.publicUrl) {
          console.error('Failed to get public URL for uploaded image');
          return getPlaceholderImageUrl(file.name);
        }
        
        console.log('Image public URL generated:', urlData.publicUrl);
        return urlData.publicUrl;
      } catch (uploadError) {
        console.error('Unexpected error during upload:', uploadError);
        return getPlaceholderImageUrl(file.name);
      }
    } catch (error: any) {
      console.error(`Upload attempt ${retryCount + 1} failed:`, error);
      
      // Check if we should retry
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying upload (${retryCount}/${maxRetries})...`);
        // Wait briefly before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return uploadWithRetry();
      }
      
      // If we've exhausted retries or it's a permissions issue, rethrow
      if (error.message?.includes('permission') || error.code === '42501' || 
          error.message?.includes('not authorized')) {
        throw new Error(`Permission denied: ${error.message}. Please check storage bucket policies.`);
      }
      
      throw error; // Let the caller handle it
    }
  };
  
  try {
    return await uploadWithRetry();
  } catch (finalError: any) {
    // Log the detailed error for debugging
    console.error('Image upload failed after retries:', finalError);
    
    // Return a fallback URL with error information encoded
    const errorMsg = encodeURIComponent(finalError.message || 'Unknown error');
    return `https://placehold.co/300x300/e2e8f0/64748b?text=Upload+Failed:+${errorMsg.substring(0, 50)}`;
  }
};
