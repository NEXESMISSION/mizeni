import React, { useState, useEffect, useMemo } from 'react';
import { Trash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getSales, getProducts, deleteSales } from '../lib/supabase';
import { Modal } from '../components/ui';

// Types
import { Product } from '../lib/supabase';

interface SaleItem {
  id: number;
  product_id: number;
  quantity: number;
  price_at_sale: number;
  cost_at_sale: number;
}

interface Sale {
  id: number;
  total_amount: number;
  total_cost: number;
  created_at: string;
  sale_items: SaleItem[];
}

// Translation object
const translations = {
  ar: {
    sales_history: "سجل المبيعات",
    date_time: "التاريخ والوقت",
    items_sold: "المنتجات المباعة",
    prev_page: "السابق",
    next_page: "التالي",
    page_of: "صفحة {currentPage} من {totalPages}",
    no_sales_yet: "لا توجد مبيعات بعد.",
    total: "المجموع:",
    loading: "جاري التحميل...",
    clear_history: "مسح سجل المبيعات",
    clear_history_confirm: "هل أنت متأكد من رغبتك في حذف سجل المبيعات؟",
    history_cleared: "تم مسح سجل المبيعات بنجاح",
    confirm: "تأكيد",
    cancel: "إلغاء",
    notification: "تنبيه"
  }
};

const t = (key: string, options: Record<string, any> = {}) => {
  let text = translations.ar[key as keyof typeof translations.ar] || key;
  Object.keys(options).forEach(optKey => {
    text = text.replace(`{${optKey}}`, options[optKey]);
  });
  return text;
};

const Reports: React.FC = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Record<number, Product>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Clear history related state
  const [clearHistoryModalOpen, setClearHistoryModalOpen] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{title: string; message: string; type: 'success' | 'error'}>({title: '', message: '', type: 'success'});
  
  const salesPerPage = 10;

  // Format currency
  const formatCurrency = (amount: number) => `${amount.toFixed(2)} د.ت`;
  
  // Format locale date
  const formatLocaleDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('ar-TN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Fetch sales and products data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        console.log('Fetching sales data for user:', user.id);
        const salesData = await getSales(user.id);
        console.log('Sales data fetched:', salesData?.length || 0, 'records');
        setSales(Array.isArray(salesData) ? salesData : []);
        
        console.log('Fetching products data for reports');
        const productsData = await getProducts(user.id);
        console.log('Products data fetched for reports:', productsData?.length || 0, 'items');
        
        // Convert products array to a map for easier lookup
        const productsMap: Record<number, Product> = {};
        if (Array.isArray(productsData)) {
          productsData.forEach(product => {
            if (product.id !== undefined) {
              productsMap[product.id] = product;
            }
          });
        }
        setProducts(productsMap);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Get current sales page
  const currentSales = useMemo(() => {
    const indexOfLastSale = currentPage * salesPerPage;
    const indexOfFirstSale = indexOfLastSale - salesPerPage;
    return sales.slice(indexOfFirstSale, indexOfLastSale);
  }, [sales, currentPage]);

  // Calculate total pages
  const totalPages = Math.ceil(sales.length / salesPerPage);

  // Handle clear history confirmation
  const handleClearHistory = async () => {
    if (!user) return;
    
    try {
      setClearingHistory(true);
      await deleteSales(user.id);
      
      // Update local state to show empty sales list
      setSales([]);
      
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

  // Display a special message if the user isn't authenticated properly
  if (!user || user.id === 'demo-user-id') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="mb-6">Please log in with valid credentials to access the sales reports.</p>
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
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t('sales_history')}</h2>
          
          {/* Clear History Button */}
          <button
            onClick={() => setClearHistoryModalOpen(true)}
            className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded-md text-sm transition-colors"
            disabled={sales.length === 0 || clearingHistory}
          >
            <Trash size={16} />
            {t('clear_history')}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
            <span className="ml-3">{t('loading')}</span>
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="space-y-3 lg:hidden">
              {currentSales.length > 0 ? (
                currentSales.map(sale => (
                  <div key={sale.id} className="bg-gray-50 p-3 rounded-lg border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">{formatLocaleDate(sale.created_at)}</span>
                      <strong className="text-lg">{formatCurrency(sale.total_amount)}</strong>
                    </div>
                    <ul className="list-none pr-4 text-sm text-gray-800">
                      {sale.sale_items.map((item, index) => (
                        <li key={index}>
                          {item.quantity}x {products[item.product_id]?.name || 'منتج محذوف'}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">{t('no_sales_yet')}</div>
              )}
            </div>

            {/* Desktop View */}
            <div className="overflow-x-auto hidden lg:block">
              <table className="w-full text-sm text-right">
                <thead className="text-xs uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3">{t('date_time')}</th>
                    <th className="px-4 py-3">{t('items_sold')}</th>
                    <th className="px-4 py-3 text-left">{t('total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSales.length > 0 ? (
                    currentSales.map(sale => (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{formatLocaleDate(sale.created_at)}</td>
                        <td className="px-4 py-2">
                          <ul className="list-none pr-4">
                            {sale.sale_items.map((item, index) => (
                              <li key={index}>
                                {item.quantity}x {products[item.product_id]?.name || 'منتج محذوف'}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-2 text-left font-semibold">
                          {formatCurrency(sale.total_amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-gray-500">
                        {t('no_sales_yet')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 pt-4">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1} 
                  className="px-3 py-1 border rounded-md disabled:opacity-50"
                >
                  {t('prev_page')}
                </button>
                <span className="text-sm">
                  {t('page_of', { currentPage, totalPages })}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages} 
                  className="px-3 py-1 border rounded-md disabled:opacity-50"
                >
                  {t('next_page')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Clear History Confirmation Modal */}
      {clearHistoryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">{t('notification')}</h3>
            <p className="mb-6">{t('clear_history_confirm')}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setClearHistoryModalOpen(false)} 
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                disabled={clearingHistory}
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleClearHistory} 
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                disabled={clearingHistory}
              >
                {clearingHistory ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('loading')}
                  </span>
                ) : t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Notification Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalContent.title}
        type={modalContent.type}
      >
        {modalContent.message}
      </Modal>
    </div>
  );
};

export default Reports;
