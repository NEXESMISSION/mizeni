import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, TrendingUp, DollarSign, BarChart2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getSales, getProducts } from '../lib/supabase';

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
    finance: "المالية",
    income_overview: "نظرة عامة على الدخل",
    total_revenue: "إجمالي الإيرادات",
    total_profit: "إجمالي الربح",
    profit_margin: "هامش الربح",
    today: "اليوم",
    yesterday: "الأمس",
    this_week: "هذا الأسبوع",
    last_week: "الأسبوع الماضي",
    this_month: "هذا الشهر",
    last_month: "الشهر الماضي",
    top_selling_items: "أفضل المنتجات مبيعاً",
    product_name: "اسم المنتج",
    quantity_sold: "الكمية المباعة",
    revenue: "الإيرادات",
    profit: "الربح",
    period: "الفترة",
    loading: "جاري التحميل...",
    no_sales_data: "لا توجد بيانات مبيعات لهذه الفترة",
    select_time_period: "اختر الفترة الزمنية"
  }
};

const t = (key: string, options: Record<string, any> = {}) => {
  let text = translations.ar[key as keyof typeof translations.ar] || key;
  Object.keys(options).forEach(optKey => {
    text = text.replace(`{${optKey}}`, options[optKey]);
  });
  return text;
};

const Finance: React.FC = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Record<number, Product>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('this_week');

  // Format currency
  const formatCurrency = (amount: number) => `${amount.toFixed(2)} د.ت`;

  // Fetch sales and products data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        console.log('Fetching sales data for finance page');
        const salesData = await getSales(user.id);
        console.log('Sales data fetched for finance:', salesData?.length || 0, 'records');
        setSales(Array.isArray(salesData) ? salesData : []);
        
        console.log('Fetching products data for finance page');
        const productsData = await getProducts(user.id);
        console.log('Products data fetched for finance:', productsData?.length || 0, 'items');
        
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
        console.error('Error fetching data for finance page:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Get date range for selected period
  const getDateRange = (period: string): { start: Date, end: Date } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    switch (period) {
      case 'today':
        return { start: today, end: now };
      case 'yesterday': {
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        return { start: yesterday, end: endOfYesterday };
      }
      case 'this_week': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        return { start: startOfWeek, end: now };
      }
      case 'last_week': {
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - today.getDay() - 7); // Start of last week
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        endOfLastWeek.setHours(23, 59, 59, 999);
        return { start: startOfLastWeek, end: endOfLastWeek };
      }
      case 'this_month': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: startOfMonth, end: now };
      }
      case 'last_month': {
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        return { start: startOfLastMonth, end: endOfLastMonth };
      }
      default:
        return { start: today, end: now };
    }
  };

  // Filter sales by selected period
  const filteredSales = useMemo(() => {
    const { start, end } = getDateRange(selectedPeriod);
    return sales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      return saleDate >= start && saleDate <= end;
    });
  }, [sales, selectedPeriod]);

  // Calculate financial metrics
  const financialMetrics = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const totalCost = filteredSales.reduce((sum, sale) => sum + sale.total_cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    return {
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin
    };
  }, [filteredSales]);

  // Calculate top selling products
  const topSellingProducts = useMemo(() => {
    if (filteredSales.length === 0) return [];
    
    // Aggregate all sale items
    const productSales: Record<number, { productId: number, quantity: number, revenue: number, profit: number }> = {};
    
    filteredSales.forEach(sale => {
      sale.sale_items.forEach(item => {
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = {
            productId: item.product_id,
            quantity: 0,
            revenue: 0,
            profit: 0
          };
        }
        
        const revenue = item.quantity * item.price_at_sale;
        const cost = item.quantity * item.cost_at_sale;
        
        productSales[item.product_id].quantity += item.quantity;
        productSales[item.product_id].revenue += revenue;
        productSales[item.product_id].profit += (revenue - cost);
      });
    });
    
    // Convert to array and sort by quantity sold
    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5) // Top 5 products
      .map(product => ({
        ...product,
        name: products[product.productId]?.name || 'منتج محذوف'
      }));
  }, [filteredSales, products]);

  // Display a special message if the user isn't authenticated properly
  if (!user || user.id === 'demo-user-id') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="mb-6">Please log in with valid credentials to access the finance page.</p>
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
      <div className="bg-white p-4 md:p-6 rounded-xl shadow-md space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t('finance')}</h2>
          
          {/* Period selector */}
          <div className="relative">
            <select
              className="bg-white border border-gray-300 rounded-lg py-2 px-4 appearance-none pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option value="today">{t('today')}</option>
              <option value="yesterday">{t('yesterday')}</option>
              <option value="this_week">{t('this_week')}</option>
              <option value="last_week">{t('last_week')}</option>
              <option value="this_month">{t('this_month')}</option>
              <option value="last_month">{t('last_month')}</option>
            </select>
            <Calendar className="absolute top-1/2 right-2 transform -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
            <span className="ml-3">{t('loading')}</span>
          </div>
        ) : (
          <>
            {filteredSales.length > 0 ? (
              <div className="space-y-8">
                {/* Income Overview */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t('income_overview')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Total Revenue */}
                    <div className="bg-blue-50 p-4 rounded-xl">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-gray-600">{t('total_revenue')}</p>
                          <p className="text-2xl font-bold mt-1">{formatCurrency(financialMetrics.totalRevenue)}</p>
                        </div>
                        <DollarSign className="text-blue-600" />
                      </div>
                    </div>
                    
                    {/* Total Profit */}
                    <div className="bg-green-50 p-4 rounded-xl">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-gray-600">{t('total_profit')}</p>
                          <p className="text-2xl font-bold mt-1">{formatCurrency(financialMetrics.totalProfit)}</p>
                        </div>
                        <TrendingUp className="text-green-600" />
                      </div>
                    </div>
                    
                    {/* Profit Margin */}
                    <div className="bg-purple-50 p-4 rounded-xl">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-gray-600">{t('profit_margin')}</p>
                          <p className="text-2xl font-bold mt-1">{financialMetrics.profitMargin.toFixed(1)}%</p>
                        </div>
                        <BarChart2 className="text-purple-600" />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Top Selling Products */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t('top_selling_items')}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="text-xs uppercase bg-gray-50 rounded-lg">
                        <tr>
                          <th className="px-4 py-3">{t('product_name')}</th>
                          <th className="px-4 py-3">{t('quantity_sold')}</th>
                          <th className="px-4 py-3">{t('revenue')}</th>
                          <th className="px-4 py-3">{t('profit')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topSellingProducts.map((product, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3">{product.name}</td>
                            <td className="px-4 py-3">{product.quantity}</td>
                            <td className="px-4 py-3">{formatCurrency(product.revenue)}</td>
                            <td className="px-4 py-3">
                              <span className="text-green-600">{formatCurrency(product.profit)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <BarChart2 size={48} className="mb-4 opacity-40" />
                <p>{t('no_sales_data')}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Finance;
