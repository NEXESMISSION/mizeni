import React, { useState } from 'react';
import { XCircle, UploadCloud } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createProduct, updateProduct, uploadProductImage } from '../../lib/supabase';

// Types
import { Product } from '../../lib/supabase';

interface ProductFormProps {
  product: Product | null;
  onClose: () => void;
  onSubmit: (product: Product) => void;
}

// Translation object
const translations = {
  ar: {
    edit_product: "تعديل المنتج",
    add_new_product: "إضافة منتج جديد",
    product_name: "اسم المنتج",
    selling_price: "سعر البيع",
    cost_price: "سعر التكلفة",
    stock_qty: "كمية المخزون",
    low_stock_threshold: "تنبيه انخفاض المخزون",
    upload_image: "انقر لرفع صورة",
    cancel: "إلغاء",
    add: "إضافة",
    update: "تحديث",
    error_required: "هذا الحقل مطلوب",
    error_numeric: "يجب أن يكون هذا الحقل رقماً موجباً",
    error_image_upload: "فشل تحميل الصورة. يرجى المحاولة مرة أخرى",
    error_general: "حدث خطأ. يرجى المحاولة مرة أخرى",
    error_permission: "ليس لديك إذن لإجراء هذه العملية",
    try_again: "حاول مرة أخرى"
  }
};

const t = (key: string) => translations.ar[key as keyof typeof translations.ar] || key;

const ProductForm: React.FC<ProductFormProps> = ({ product, onClose, onSubmit }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<{
    name: string;
    selling_price: string;
    cost_price: string;
    stock: string;
    low_stock_threshold: string;
    image_url: string;
  }>(
    product ? {
      name: product.name,
      selling_price: product.selling_price.toString(),
      cost_price: product.cost_price.toString(),
      stock: product.stock.toString(),
      low_stock_threshold: product.low_stock_threshold.toString(),
      image_url: product.image_url
    } : {
      name: '',
      selling_price: '',
      cost_price: '',
      stock: '0',
      low_stock_threshold: '5',
      image_url: ''
    }
  );
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(product?.image_url || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Handle image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (file) {
      setImageFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Validate form
  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.name.trim()) newErrors.name = t('error_required');
    
    // Numeric fields
    if (!formData.selling_price || parseFloat(formData.selling_price) <= 0) {
      newErrors.selling_price = t('error_numeric');
    }
    if (!formData.cost_price || parseFloat(formData.cost_price) <= 0) {
      newErrors.cost_price = t('error_numeric');
    }
    if (!formData.stock || parseInt(formData.stock) < 0) {
      newErrors.stock = t('error_numeric');
    }
    if (!formData.low_stock_threshold || parseInt(formData.low_stock_threshold) < 0) {
      newErrors.low_stock_threshold = t('error_numeric');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate() || !user) return;
    
    // Clear previous errors
    setFormError('');
    setIsSubmitting(true);
    
    try {
      let imageUrl = formData.image_url;
      
      // Upload new image if selected
      if (imageFile) {
        try {
          console.log('Uploading image for user:', user.id);
          imageUrl = await uploadProductImage(user.id, imageFile);
          
          if (!imageUrl || imageUrl.includes('placeholder')) {
            console.error('Image upload returned placeholder URL');
            setFormError(t('error_image_upload'));
            return;
          }
          console.log('Image uploaded successfully:', imageUrl);
        } catch (imageError) {
          console.error('Image upload failed:', imageError);
          setFormError(t('error_image_upload'));
          setIsSubmitting(false);
          return;
        }
      }
      
      // Prepare data for submission
      const productData: Product = {
        id: product?.id,
        name: formData.name,
        selling_price: parseFloat(formData.selling_price),
        cost_price: parseFloat(formData.cost_price),
        stock: parseInt(formData.stock),
        low_stock_threshold: parseInt(formData.low_stock_threshold),
        image_url: imageUrl,
        user_id: user.id, // Ensure user ID is properly assigned
        created_at: product?.created_at,
        updated_at: new Date().toISOString()
      };
      
      console.log('Submitting product data:', { ...productData, user_id: user.id });
      
      if (product) {
        // Update existing product
        console.log('Updating product ID:', product.id);
        const updatedProduct = await updateProduct(product.id!, productData);
        if (!updatedProduct) {
          throw new Error('Failed to update product');
        }
        console.log('Product updated successfully');
        onSubmit(updatedProduct);
      } else {
        // Create new product
        console.log('Creating new product for user:', user.id);
        const newProduct = await createProduct(productData, user.id);
        if (!newProduct) {
          throw new Error('Failed to create product');
        }
        console.log('Product created successfully:', newProduct.id);
        onSubmit(newProduct);
      }
    } catch (error: any) {
      console.error('Error submitting product:', error);
      
      // Handle specific error types
      if (error.message?.includes('permission') || error.code === '42501') {
        setFormError(t('error_permission'));
      } else {
        setFormError(t('error_general') + (error.message ? `: ${error.message}` : ''));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-screen overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-bold">
            {product ? t('edit_product') : t('add_new_product')}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XCircle size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Form-level error message */}
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 mb-4 flex flex-col sm:flex-row items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm">{formError}</span>
              </div>
              <button 
                type="button"
                onClick={() => setFormError('')} 
                className="text-sm text-red-600 hover:text-red-800 mt-2 sm:mt-0 underline"
              >
                {t('try_again')}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column - Product Details */}
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-1" htmlFor="name">
                  {t('product_name')}
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? 'border-red-500' : ''
                  }`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1" htmlFor="selling_price">
                  {t('selling_price')}
                </label>
                <input
                  id="selling_price"
                  name="selling_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.selling_price}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    errors.selling_price ? 'border-red-500' : ''
                  }`}
                />
                {errors.selling_price && <p className="text-red-500 text-xs mt-1">{errors.selling_price}</p>}
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1" htmlFor="cost_price">
                  {t('cost_price')}
                </label>
                <input
                  id="cost_price"
                  name="cost_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_price}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    errors.cost_price ? 'border-red-500' : ''
                  }`}
                />
                {errors.cost_price && <p className="text-red-500 text-xs mt-1">{errors.cost_price}</p>}
              </div>
            </div>
            
            {/* Right Column - Image and Stock */}
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-1" htmlFor="stock">
                  {t('stock_qty')}
                </label>
                <input
                  id="stock"
                  name="stock"
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    errors.stock ? 'border-red-500' : ''
                  }`}
                />
                {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock}</p>}
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1" htmlFor="low_stock_threshold">
                  {t('low_stock_threshold')}
                </label>
                <input
                  id="low_stock_threshold"
                  name="low_stock_threshold"
                  type="number"
                  min="0"
                  value={formData.low_stock_threshold}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    errors.low_stock_threshold ? 'border-red-500' : ''
                  }`}
                />
                {errors.low_stock_threshold && <p className="text-red-500 text-xs mt-1">{errors.low_stock_threshold}</p>}
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">
                  {t('upload_image')}
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    {imagePreview ? (
                      <div className="mb-4">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="mx-auto h-32 w-32 object-cover rounded-md"
                        />
                      </div>
                    ) : (
                      <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                    )}
                    <div className="flex justify-center text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500"
                      >
                        <span>{t('upload_image')}</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleImageChange}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 border-t pt-4 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
              disabled={isSubmitting}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                  {product ? t('update') : t('add')}
                </div>
              ) : (
                product ? t('update') : t('add')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
