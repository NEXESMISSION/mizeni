import React, { useMemo } from 'react';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { Product } from '../../lib/supabase';


interface CartItem {
  product_id: number;
  quantity: number;
  price_at_sale: number;
}

interface CartProps {
  cart: CartItem[];
  products: Product[];
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onCheckout: () => void;
  formatCurrency: (amount: number) => string;
}

// Translation object
const translations = {
  ar: {
    current_sale: "البيع الحالي",
    tap_to_start: "انقر على منتج للبدء.",
    total: "المجموع:",
    complete_sale: "إتمام البيع",
    available: "متاح:",
    out_of_stock: "غير متوفر"
  }
};

const t = (key: string) => translations.ar[key as keyof typeof translations.ar] || key;

const Cart: React.FC<CartProps> = ({ cart, products, onUpdateQuantity, onCheckout, formatCurrency }) => {
  // Calculate total
  const total = useMemo(() => {
    return cart.reduce((sum, item) => {
      return sum + (item.price_at_sale * item.quantity);
    }, 0);
  }, [cart]);

  return (
    <div className="bg-white rounded-lg shadow-lg w-full lg:w-80 xl:w-96 flex flex-col p-4 border flex-shrink-0 h-full lg:max-h-screen overflow-hidden">
      <h2 className="text-xl font-bold border-b pb-2 mb-4 flex items-center gap-2">
        <ShoppingCart /> 
        {t('current_sale')}
      </h2>
      
      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <p className="text-gray-500 text-center py-10">{t('tap_to_start')}</p>
        ) : (
          <ul className="space-y-2">
            {cart.map(item => {
              const product = products.find(p => p.id === item.product_id);
              if (!product) return null;
              
              return (
                <li key={item.product_id} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50">
                  <img 
                    src={product.image_url || 'https://placehold.co/150x150/e2e8f0/64748b?text=No+Image'} 
                    alt={product.name} 
                    className="w-12 h-12 rounded-md object-cover flex-shrink-0" 
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{product.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(item.price_at_sale)}</p>
                    <p className="text-xs text-gray-500">
                      {t('available')}: <span className={product.stock < 5 ? 'text-red-500 font-medium' : ''}>
                        {product.stock}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={item.quantity} 
                      onChange={(e) => onUpdateQuantity(item.product_id, parseInt(e.target.value) || 0)} 
                      min="1"
                      max={product.stock}
                      className="w-14 h-8 text-center border rounded-md p-1 bg-white font-bold text-lg"
                    />
                    <button 
                      onClick={() => onUpdateQuantity(item.product_id, 0)} 
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
      <div className="border-t pt-4 mt-4">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>{t('total')}</span>
          <span>{formatCurrency(total)}</span>
        </div>
        <button 
          onClick={onCheckout} 
          disabled={cart.length === 0} 
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mt-4 hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {t('complete_sale')}
        </button>
      </div>
    </div>
  );
};

export default Cart;
