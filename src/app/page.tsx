"use client";

import { useApp } from "@/lib/store";
import { TopBar } from "@/components/shell/TopBar";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { LoginScreen } from "@/components/screens/LoginScreen";
import { DashboardScreen } from "@/components/screens/DashboardScreen";
import { InventoryScreen } from "@/components/screens/InventoryScreen";
import { ItemAddEditScreen } from "@/components/screens/ItemAddEditScreen";
import { ItemDetailScreen } from "@/components/screens/ItemDetailScreen";
import { StockAdjustmentScreen } from "@/components/screens/StockAdjustmentScreen";
import { SaleNewScreen } from "@/components/screens/SaleNewScreen";
import { BillHistoryScreen } from "@/components/screens/BillHistoryScreen";
import { ReturnScreen } from "@/components/screens/ReturnScreen";
import { PurchaseNewScreen } from "@/components/screens/PurchaseNewScreen";
import { CustomersScreen, CustomerDetailScreen } from "@/components/screens/CustomersScreen";
import { SuppliersScreen, SupplierDetailScreen } from "@/components/screens/SuppliersScreen";
import { NotificationsScreen } from "@/components/screens/NotificationsScreen";
import {
  AiImportListScreen,
  AiImportReviewScreen,
} from "@/components/screens/AiImportScreens";
import { CustomerCatalogScreen } from "@/components/screens/CustomerCatalogScreen";
import { CategoryImageLibraryScreen } from "@/components/screens/CategoryImageLibraryScreen";
import { CategoryImagePickScreen } from "@/components/screens/CategoryImagePickScreen";

export default function Home() {
  const isAuthed = useApp((s) => s.isAuthed);
  const screen = useApp((s) => s.screen);

  if (!isAuthed || screen === "login") {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#f1f5f4] max-w-[560px] mx-auto">
      <TopBar />
      <main className="min-h-[calc(100vh-110px)]">
        {screen === "dashboard" && <DashboardScreen />}
        {screen === "inventory" && <InventoryScreen />}
        {(screen === "item-add" || screen === "item-edit") && <ItemAddEditScreen />}
        {screen === "item-detail" && <ItemDetailScreen />}
        {screen === "stock-adjust" && <StockAdjustmentScreen />}
        {screen === "sale-new" && <SaleNewScreen />}
        {screen === "bill-history" && <BillHistoryScreen />}
        {screen === "return" && <ReturnScreen />}
        {screen === "purchase-new" && <PurchaseNewScreen />}
        {screen === "customers" && <CustomersScreen />}
        {screen === "customer-detail" && <CustomerDetailScreen />}
        {screen === "suppliers" && <SuppliersScreen />}
        {screen === "supplier-detail" && <SupplierDetailScreen />}
        {screen === "notifications" && <NotificationsScreen />}
        {screen === "ai-import-list" && <AiImportListScreen />}
        {screen === "ai-import-review" && <AiImportReviewScreen />}
        {screen === "customer-catalog" && <CustomerCatalogScreen />}
        {screen === "category-images" && <CategoryImageLibraryScreen />}
        {screen === "category-image-pick" && <CategoryImagePickScreen />}
      </main>
      <BottomTabBar />
    </div>
  );
}

