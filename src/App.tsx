import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkshopProvider } from './context/WorkshopContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginView } from './components/auth/LoginView';
import { DashboardView } from './components/dashboard/DashboardView';
import { WorkOrdersListView } from './components/workOrders/WorkOrdersListView';
import { SalesListView } from './components/sales/SalesListView';
import { ProductsView } from './components/catalog/ProductsView';
import { CustomersView } from './components/catalog/CustomersView';
import { BicyclesView } from './components/catalog/BicyclesView';
import { ServicesView } from './components/catalog/ServicesView';
import { SuppliersView } from './components/catalog/SuppliersView';
import { StockDashboardView } from './components/stock/StockDashboardView';
import { StockMovementsView } from './components/stock/StockMovementsView';
import { FinancialView } from './components/financial/FinancialView';
import { ReportsView } from './components/reports/ReportsView';
import { WorkshopSettingsView } from './components/settings/WorkshopSettingsView';
import { UsersView } from './components/settings/UsersView';
import { PermissionsView } from './components/settings/PermissionsView';

const MainAppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [targetItemId, setTargetItemId] = useState<number | null>(null);

  // Ensure user is navigated to an accessible view for their role
  React.useEffect(() => {
    if (!isAuthenticated || !user) return;

    const viewPermissions: Record<string, string> = {
      'dashboard': 'Dashboard.View',
      'work-orders': 'WorkOrders.View',
      'sales': 'Sales.View',
      'customers': 'Customers.View',
      'bicycles': 'Bicycles.View',
      'products': 'Products.View',
      'services': 'Services.View',
      'suppliers': 'Suppliers.View',
      'stock': 'Stock.View',
      'stock-movements': 'Stock.View',
      'financial': 'Sales.View',
      'reports': 'Reports.View',
      'settings-workshop': 'WorkshopSettings.View',
      'users': 'Users.View',
      'permissions': 'Users.View',
    };

    const requiredPermission = viewPermissions[currentView];
    if (requiredPermission && !hasPermission(requiredPermission)) {
      const firstValidView = Object.keys(viewPermissions).find((v) =>
        hasPermission(viewPermissions[v])
      );
      if (firstValidView) {
        setCurrentView(firstValidView);
      }
    }
  }, [user, isAuthenticated, currentView, hasPermission]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#040915] text-[#F8F8F8] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-3 border-[#EF7410] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#ACB0B0] font-mono tracking-wider uppercase">
            INICIALIZANDO BIKE SHOP
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const handleNavigate = (view: string, itemId?: number) => {
    setCurrentView(view);
    setTargetItemId(itemId || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AppLayout currentView={currentView} onNavigate={handleNavigate}>
      {currentView === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}

      {currentView === 'work-orders' && (
        <WorkOrdersListView
          initialWorkOrderId={targetItemId}
          onNavigateToSale={(saleId) => handleNavigate('sales', saleId)}
        />
      )}

      {currentView === 'sales' && (
        <SalesListView
          initialSaleId={targetItemId}
          onNavigateToWorkOrder={(woId) => handleNavigate('work-orders', woId)}
        />
      )}

      {currentView === 'customers' && <CustomersView />}
      {currentView === 'bicycles' && <BicyclesView />}
      {currentView === 'products' && <ProductsView />}
      {currentView === 'services' && <ServicesView />}
      {currentView === 'suppliers' && <SuppliersView />}

      {currentView === 'stock' && (
        <StockDashboardView
          onNavigateToMovements={() => handleNavigate('stock-movements')}
          onNavigateToProducts={() => handleNavigate('products')}
        />
      )}

      {currentView === 'stock-movements' && <StockMovementsView />}
      {currentView === 'financial' && <FinancialView />}
      {currentView === 'reports' && <ReportsView />}
      {currentView === 'settings-workshop' && <WorkshopSettingsView />}
      {currentView === 'users' && <UsersView />}
      {currentView === 'permissions' && <PermissionsView />}
    </AppLayout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <WorkshopProvider>
        <MainAppContent />
      </WorkshopProvider>
    </AuthProvider>
  );
}
