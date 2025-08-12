import React, { useState, useEffect, useMemo } from 'react';
import { Search, Trash, ShoppingCart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getProducts, createSale, Product, deleteSales } from '../lib/supabase';
import { Cart, Modal } from '../components/ui';

// Format currency helper
const formatCurrency = (amount: number): string => {
  // Format number with 2 decimal places
  const formattedAmount = amount.toFixed(2);
  // Add the Libyan Dinar symbol
  return `${formattedAmount} د.ت`;
};

interface CartItem {
  product_id: number;
  quantity: number;
  price_at_sale: number;
  cost_at_sale: number;
}

// Translation object
const translations = {
  ar: {
    search_products: "ابحث عن المنتجات...",
    low_stock_alert: "منخفض",
    sale_completed: "تمت عملية البيع بنجاح",
    error_completing_sale: "خطأ في إتمام البيع",
    insufficient_stock: "لا يوجد مخزون كافٍ",
    max_stock_reached: "تم الوصول للحد الأقصى من المخزون المتاح",
    clear_history: "مسح سجل المبيعات",
    clear_history_confirm: "هل أنت متأكد من رغبتك في حذف سجل المبيعات؟",
    history_cleared: "تم مسح سجل المبيعات بنجاح",
    confirm: "تأكيد",
    cancel: "إلغاء",
    notification: "تنبيه"
  }
};

const t = (key: string) => translations.ar[key as keyof typeof translations.ar] || key;

const POS: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ title: '', message: '', type: 'info' });
  
  // Clear history confirmation modal
  const [clearHistoryModalOpen, setClearHistoryModalOpen] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  // Fetch products on component mount
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        console.warn('No authenticated user found');
        setError('User not authenticated');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching products for user:', user.id);
        
        // Use the user ID from the authenticated user
        const productsData = await getProducts(user.id);
        console.log('Products fetched successfully, count:', productsData?.length || 0);
        
        setProducts(Array.isArray(productsData) ? productsData : []);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Filter products based on search term
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      return product.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [products, searchTerm]);

  // Add product to cart
  const handleAddToCart = (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.product_id === productId);
    const currentQuantity = existingItem ? existingItem.quantity : 0;
    
    // Check if adding one more would exceed available stock
    if (currentQuantity + 1 > product.stock) {
      // Show insufficient stock notification in modal
      setModalContent({
        title: t('notification'),
        message: t('max_stock_reached'),
        type: 'error'
      });
      setModalOpen(true);
      
      return;
    }
    
    setCart((prevCart) => {
      if (existingItem) {
        // Update quantity if already in cart
        return prevCart.map(item => 
          item.product_id === productId 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      } else {
        // Add new item to cart
        return [
          ...prevCart, 
          {
            product_id: productId,
            quantity: 1,
            price_at_sale: product.selling_price,
            cost_at_sale: product.cost_price
          }
        ];
      }
    });
  };

  // Update item quantity in cart
  const handleUpdateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      // Remove from cart if quantity is 0 or less
      setCart(prevCart => prevCart.filter(item => item.product_id !== productId));
      return;
    }
    
    // Check if new quantity exceeds available stock
    const product = products.find(p => p.id === productId);
    if (product && quantity > product.stock) {
      // Show insufficient stock notification in modal
      setModalContent({
        title: t('notification'),
        message: t('insufficient_stock'),
        type: 'error'
      });
      setModalOpen(true);
      
      return;
    }
    
    // Update quantity if stock is sufficient
    setCart(prevCart => 
      prevCart.map(item => 
        item.product_id === productId 
          ? { ...item, quantity } 
          : item
      )
    );
  };

  // Clear search and focus on input
  const handleClearSearch = () => {
    setSearchTerm('');
    // Focus on the search input after clearing
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Complete sale
  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;
    
    try {
      const totalAmount = cart.reduce((sum, item) => {
        return sum + (item.price_at_sale * item.quantity);
      }, 0);
      
      const totalCost = cart.reduce((sum, item) => {
        return sum + (item.cost_at_sale * item.quantity);
      }, 0);
      
      await createSale(user.id, cart, totalAmount, totalCost);
      
      // Update local product stock
      const updatedProducts = products.map(product => {
        const cartItem = cart.find(item => item.product_id === product.id);
        if (cartItem) {
          return {
            ...product,
            stock: product.stock - cartItem.quantity
          };
        }
        return product;
      });
      
      setProducts(updatedProducts);
      setCart([]);
      // Show success notification in modal
      setModalContent({
        title: t('notification'),
        message: t('sale_completed'),
        type: 'success'
      });
      setModalOpen(true);
      
    } catch (error) {
      console.error('Error completing sale:', error);
      // Show error notification in modal
      setModalContent({
        title: t('notification'),
        message: t('error_completing_sale'),
        type: 'error'
      });
      setModalOpen(true);
    }
  };

  // Debugging logs
  console.log('Rendering POS component');
  console.log('User:', user);
  console.log('Products:', products);
  console.log('Loading:', loading);
  console.log('Error:', error);

  // Display a special message if the user isn't authenticated properly
  if (!user || user.id === 'demo-user-id') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="mb-6">Please log in with valid credentials to access the POS system.</p>
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

  // Handle clear history confirmation
  const handleClearHistory = async () => {
    if (!user) return;
    
    try {
      setClearingHistory(true);
      await deleteSales(user.id);
      
      // Show success notification
      setModalContent({
        title: t('notification'),
        message: t('history_cleared'),
        type: 'success'
      });
      setModalOpen(true);
      
    } catch (error) {
      console.error('Error clearing sales history:', error);
      
      // Show error notification
      setModalContent({
        title: t('notification'),
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'error'
      });
      setModalOpen(true);
      
    } finally {
      setClearHistoryModalOpen(false);
      setClearingHistory(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full bg-gray-50">
      {/* Main content area */}
      <div className="flex-1 flex flex-col h-full">
        {/* Fixed header with search and buttons - Always visible */}
        <div className="sticky top-0 bg-white z-10 p-4 border-b shadow-sm">
          {/* Error state */}
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-100 text-red-800">
              Error: {error}. Please refresh the page or contact support.
            </div>
          )}
          
          {/* Search - Always visible on all devices */}
          <div className="mb-4 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder={t('search_products')} 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pr-10 pl-4 py-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-transparent text-lg" 
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <Trash size={18} />
              </button>
            )}
          </div>
          
          {/* Space for additional buttons if needed */}
        </div>
        
        {/* Products grid - Only this area scrolls */}
        <div className="flex-1 overflow-y-auto px-4 pb-32">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
            </div>
          ) : error ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center p-6 bg-white rounded-xl shadow">
                <p className="text-red-500 font-medium">Unable to load products</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 py-4">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => product.id !== undefined ? handleAddToCart(product.id) : null} 
                  className="bg-white rounded-xl shadow-md border p-3 flex flex-col items-center text-center cursor-pointer hover:shadow-lg hover:border-blue-400 transition-all relative"
                >
                  {product.stock <= product.low_stock_threshold && (
                    <div className="absolute top-1 left-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {t('low_stock_alert')}
                    </div>
                  )}
                  <img 
                    src={product.image_url || 'https://placehold.co/150x150/e2e8f0/64748b?text=No+Image'} 
                    alt={product.name} 
                    className="w-20 h-20 object-cover rounded-xl mb-2" 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = 'https://placehold.co/150x150/e2e8f0/64748b?text=No+Image';
                    }}
                  />
                  <h3 className="font-semibold text-sm flex-grow">{product.name}</h3>
                  <p className="text-blue-600 font-bold mt-1">{formatCurrency(product.selling_price)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-gray-500 bg-white rounded-lg shadow p-4 mx-auto max-w-lg mt-4">
              <p className="text-xl">لا توجد منتجات متطابقة مع البحث</p>
              <p className="mt-2">Try a different search term or add products to your inventory</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Cart - For desktop view */}
      <div className="hidden lg:block">
        <Cart
          cart={cart}
          products={products}
          onUpdateQuantity={handleUpdateQuantity}
          onCheckout={handleCheckout}
          formatCurrency={formatCurrency}
        />
      </div>
      
      {/* Fixed cart summary at bottom for mobile - positioned above the navigation bar */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 bg-white border-t p-2 z-40 shadow-lg">
        {/* Selected items display - compact and scrollable */}
        {cart.length > 0 && (
          <div className="flex overflow-x-auto pb-2 mb-2 gap-2 hide-scrollbar">
            {/* Group cart items by product_id and combine quantities */}
            {Object.values(
              cart.reduce<Record<number, {product_id: number, quantity: number, price_at_sale: number, product: Product | undefined}>>(
                (acc, item) => {
                  const product = products.find(p => p.id === item.product_id);
                  if (!product) return acc;
                  
                  // If product already in accumulator, add to quantity
                  if (acc[item.product_id]) {
                    acc[item.product_id].quantity += item.quantity;
                  } else {
                    // Otherwise create new entry
                    acc[item.product_id] = { 
                      product_id: item.product_id, 
                      quantity: item.quantity, 
                      price_at_sale: item.price_at_sale,
                      product
                    };
                  }
                  return acc;
                }, {}
              )
            ).map(({ product_id, quantity, product }) => {
              if (!product) return null;
              
              return (
                <div key={product_id} className="flex-shrink-0 bg-gray-50 rounded-xl p-2 border flex flex-col items-center gap-1 min-w-[100px] max-w-[100px]">
                  <img 
                    src={product.image_url || 'https://placehold.co/150x150/e2e8f0/64748b?text=No+Image'} 
                    alt={product.name} 
                    className="w-10 h-10 rounded-xl object-cover" 
                  />
                  <p className="text-xs font-medium truncate w-full text-center">{product.name}</p>
                  
                  {/* Quantity control with manual input */}
                  <div className="flex items-center justify-between w-full mt-1 relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // Don't go below 1
                        if (quantity > 1) {
                          handleUpdateQuantity(product_id, quantity - 1);
                        }
                      }}
                      className="bg-gray-200 text-gray-700 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      -
                    </button>
                    
                    {/* Clickable quantity that opens manual input */}
                    <input
                      type="number"
                      value={quantity}
                      min="1"
                      max={product.stock}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        const newQty = parseInt(e.target.value, 10);
                        if (!isNaN(newQty) && newQty >= 1 && newQty <= product.stock) {
                          handleUpdateQuantity(product_id, newQty);
                        }
                      }}
                      className="w-7 h-5 text-xs font-bold text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-sm"
                    />
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // Don't exceed stock
                        if (quantity < product.stock) {
                          handleUpdateQuantity(product_id, quantity + 1);
                        }
                      }}
                      className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <ShoppingCart className="text-blue-600 mr-2" />
            <span className="text-sm">{cart.length} {cart.length === 1 ? 'item' : 'items'}</span>
          </div>
          <div className="font-bold">{formatCurrency(cart.reduce((sum, item) => sum + (item.price_at_sale * item.quantity), 0))}</div>
        </div>
        <button 
          onClick={handleCheckout} 
          disabled={cart.length === 0} 
          className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {t('complete_sale')}
        </button>
      </div>
      
      {/* Notification Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalContent.title}
        type={modalContent.type}
      >
        <p className="text-center text-lg">{modalContent.message}</p>
      </Modal>
      
      {/* Clear History Confirmation Modal */}
      <Modal
        isOpen={clearHistoryModalOpen}
        onClose={() => setClearHistoryModalOpen(false)}
        title={t('clear_history')}
        type="info"
      >
        <div className="py-4">
          <p className="text-center text-lg mb-4">{t('clear_history_confirm')}</p>
          
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setClearHistoryModalOpen(false)}
              className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md font-medium"
              disabled={clearingHistory}
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleClearHistory}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2"
              disabled={clearingHistory}
            >
              {clearingHistory ? (
                <span className="inline-block w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
              ) : (
                <Trash size={16} />
              )}
              {t('confirm')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default POS;
