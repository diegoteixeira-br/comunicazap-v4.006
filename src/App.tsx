import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ConnectWhatsApp from "./pages/ConnectWhatsApp";
import SelectImportMethod from "./pages/SelectImportMethod";
import Upload from "./pages/Upload";
import Results from "./pages/Results";
import History from "./pages/History";
import Contacts from "./pages/Contacts";
import BirthdayCalendar from "./pages/BirthdayCalendar";
import Subscription from "./pages/Subscription";
import NotFound from "./pages/NotFound";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import RefundPolicy from "./pages/RefundPolicy";
import StripeDiagnostic from "./pages/StripeDiagnostic";
import AdminSupport from "./pages/AdminSupport";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SubscriptionGate } from "./components/SubscriptionGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/connect-whatsapp" element={<ProtectedRoute><ConnectWhatsApp /></ProtectedRoute>} />
          <Route path="/select-import-method" element={<ProtectedRoute><SubscriptionGate><SelectImportMethod /></SubscriptionGate></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute><SubscriptionGate><Upload /></SubscriptionGate></ProtectedRoute>} />
          <Route path="/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
          <Route path="/birthday-calendar" element={<ProtectedRoute><BirthdayCalendar /></ProtectedRoute>} />
          <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/stripe-diagnostic" element={<ProtectedRoute><StripeDiagnostic /></ProtectedRoute>} />
          <Route path="/admin/support" element={<ProtectedRoute><AdminSupport /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
