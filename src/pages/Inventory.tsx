import React, { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getProducts, deleteProduct } from '../lib/supabase';
import ProductForm from '../components/ui/ProductForm';

// Types
import { Product } from '../lib/supabase';

// Category interface has been removed

// Translation object
const translations = {
  ar: {
    inventory_management: "إدارة المخزون",
    add_product: "إضافة منتج",
    product: "المنتج",
    stock: "المخزون",
    profit_margin: "هامش الربح",
    actions: "الإجراءات",
    low_stock_alert: "منخفض",
    delete_confirm: "هل تريد حذف هذا المنتج؟",
    delete_success: "تم حذف المنتج بنجاح",
    delete_error: "حدث خطأ أثناء حذف المنتج",
    no_products: "لا توجد منتجات. أضف منتجات لعرضها هنا.",
    all_products: "كل المنتجات",
    low_stock_only: "المنتجات منخفضة المخزون",
    new_products: "المنتجات الجديدة",
    filter_products: "تصفية المنتجات"
  }
};

const t = (key: string) => translations.ar[key as keyof typeof translations.ar] || key;

const Inventory: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'new'>('all');

  // Fetch products on component mount
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        console.log('Fetching inventory products for user:', user.id);
        const productsData = await getProducts(user.id);
        console.log('Inventory products fetched:', productsData?.length || 0, 'items');
        const productsArray = Array.isArray(productsData) ? productsData : [];
        setAllProducts(productsArray);
        setProducts(productsArray);
      } catch (error) {
        console.error('Error fetching inventory data:', error);
        setNotification({
          message: 'Failed to load inventory data. Please try again.',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);
  
  // Apply filters whenever filterType changes
  useEffect(() => {
    if (allProducts.length === 0) return;
    
    switch (filterType) {
      case 'low_stock':
        // Filter products where stock is at or below their low_stock_threshold
        setProducts(allProducts.filter(p => p.stock <= p.low_stock_threshold));
        break;
      case 'new':
        // Sort by creation date (newest first) and take the most recent 20%
        const sortedByDate = [...allProducts].sort((a, b) => {
          const dateA = new Date(a.created_at || '').getTime();
          const dateB = new Date(b.created_at || '').getTime();
          return dateB - dateA;
        });
        const newCount = Math.max(Math.ceil(sortedByDate.length * 0.2), 5); // At least 5 items or 20%
        setProducts(sortedByDate.slice(0, newCount));
        break;
      default: // 'all'
        setProducts(allProducts);
        break;
    }
  }, [filterType, allProducts]);

  // Format currency
  const formatCurrency = (amount: number) => `${amount.toFixed(2)} د.ت`;

  // Calculate profit margin
  const getProfitMargin = (p: Product) => {
    return p.selling_price > 0 
      ? ((p.selling_price - p.cost_price) / p.selling_price) * 100 
      : 0;
  };

  // Handle edit product
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  // Handle delete product
  const handleDelete = async (productId: number) => {
    if (window.confirm(t('delete_confirm'))) {
      try {
        await deleteProduct(productId);
        setProducts(prev => prev.filter(p => p.id !== productId));
        setNotification({
          message: t('delete_success'),
          type: 'success'
        });
      } catch (error) {
        console.error('Error deleting product:', error);
        setNotification({
          message: t('delete_error'),
          type: 'error'
        });
      }

      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  // Handle form close
  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
  };

  // Handle form submission (either add or update)
  const handleProductSubmit = (newProduct: Product) => {
    if (editingProduct) {
      // Update existing product
      setProducts(prev => 
        prev.map(p => p.id === newProduct.id ? newProduct : p)
      );
    } else {
      // Add new product
      setProducts(prev => [newProduct, ...prev]);
    }
    
    setIsFormOpen(false);
    setEditingProduct(null);
  };

  // Display a special message if the user isn't authenticated properly
  if (!user || user.id === 'demo-user-id') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="mb-6">Please log in with valid credentials to access the inventory system.</p>
          <p className="text-sm text-gray-600 mb-4">The application no longer supports demo mode and requires proper authentication.</p>
          <a 
            href="/auth" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Go to Login Page
          </a>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      {notification && (
        <div 
          className={`mb-4 p-3 rounded-md ${
            notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {notification.message}
        </div>
      )}
      
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-2">
          <h2 className="text-2xl font-bold">{t('inventory_management')}</h2>
          
          <div className="flex gap-2 flex-wrap items-center">
            {/* Filter buttons */}
            <div className="bg-white border rounded-lg p-1 flex">
              <button 
                onClick={() => setFilterType('all')} 
                className={`px-3 py-1.5 text-sm rounded-md ${filterType === 'all' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
              >
                {t('all_products')}
              </button>
              <button 
                onClick={() => setFilterType('low_stock')} 
                className={`px-3 py-1.5 text-sm rounded-md ${filterType === 'low_stock' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
              >
                {t('low_stock_only')}
              </button>
              <button 
                onClick={() => setFilterType('new')} 
                className={`px-3 py-1.5 text-sm rounded-md ${filterType === 'new' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
              >
                {t('new_products')}
              </button>
            </div>
            
            <button 
              onClick={() => setIsFormOpen(true)} 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
            >
              <PlusCircle size={20}/>
              {t('add_product')}
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
              {products.length > 0 ? (
                products.map(p => (
                  <div key={p.id} className="bg-gray-50 rounded-lg p-3 border space-y-2">
                    <div className="flex items-center gap-3">
                      <img 
                        src={p.image_url || 'https://placehold.co/150x150/e2e8f0/64748b?text=No+Image'} 
                        alt={p.name} 
                        className="w-12 h-12 rounded-md object-cover" 
                      />
                      <div>
                        <h3 className="font-bold">{p.name}</h3>
                        <p className="text-xs text-gray-500">{formatCurrency(p.selling_price)}</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {t('stock')}: <strong className="text-black">{p.stock}</strong>
                      </span>
                      <span className="text-gray-600">
                        {t('profit_margin')}: <strong className="text-green-600">{getProfitMargin(p).toFixed(1)}%</strong>
                      </span>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-2">
                      <button 
                        onClick={() => handleEdit(p)} 
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit size={20}/>
                      </button>
                      <button 
                        onClick={() => p.id !== undefined ? handleDelete(p.id) : null} 
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={20}/>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-10 text-center text-gray-500">
                  {t('no_products')}
                </div>
              )}
            </div>
            
            {/* Desktop View - Table */}
            <div className="overflow-x-auto hidden lg:block">
              <table className="w-full text-sm text-right">
                <thead className="text-xs uppercase bg-gray-50">
                  <tr className="border-b">
                    <th className="px-4 py-3">{t('product')}</th>
                    <th className="px-4 py-3">{t('stock')}</th>
                    <th className="px-4 py-3">{t('profit_margin')}</th>
                    <th className="px-4 py-3">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length > 0 ? (
                    products.map(p => (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium flex items-center gap-3">
                          <img 
                            src={p.image_url || 'https://placehold.co/150x150/e2e8f0/64748b?text=No+Image'} 
                            alt={p.name} 
                            className="w-10 h-10 rounded-md object-cover" 
                          />
                          <div>
                            {p.name}
                            <div className="text-xs text-gray-500">{formatCurrency(p.selling_price)}</div>
                          </div>
                        </td>
                        {/* Category column removed */}
                        <td className="px-4 py-2 font-bold">
                          {p.stock} 
                          {p.stock <= p.low_stock_threshold && (
                            <span className="text-red-500">({t('low_stock_alert')})</span>
                          )}
                        </td>
                        <td className="px-4 py-2">{getProfitMargin(p).toFixed(1)}%</td>
                        <td className="px-4 py-2 flex items-center gap-2">
                          <button 
                            onClick={() => handleEdit(p)} 
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit size={20}/>
                          </button>
                          <button 
                            onClick={() => p.id !== undefined ? handleDelete(p.id) : null} 
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={20}/>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                        {t('no_products')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Product Form Modal */}
      {isFormOpen && (
        <ProductForm
          product={editingProduct}
          onClose={handleFormClose}
          onSubmit={handleProductSubmit}
        />
      )}
    </div>
  );
};

export default Inventory;
