import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import ErrorBoundary from './components/ErrorBoundary'
import OfflineBanner from './components/OfflineBanner'
import { CartProvider } from './context/CartContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SEOProvider } from './context/SEOContext'

// Chargement immédiat — pages critiques above-the-fold
import HomePage    from './pages/HomePage'
import LoginPage   from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'

// Chargement différé — réduit le bundle initial
const ShopPage          = lazy(() => import('./pages/ShopPage'))
const ShopDetailPage    = lazy(() => import('./pages/ShopDetailPage'))
const ProductPage       = lazy(() => import('./pages/ProductPage'))
const CartPage          = lazy(() => import('./pages/CartPage'))
const CheckoutPage      = lazy(() => import('./pages/CheckoutPage'))
const MyOrdersPage      = lazy(() => import('./pages/MyOrdersPage'))
const MessagesPage      = lazy(() => import('./pages/MessagesPage'))
const SupportPage       = lazy(() => import('./pages/SupportPage'))
const BuyerRegisterPage = lazy(() => import('./pages/BuyerRegisterPage'))
const AccountPage       = lazy(() => import('./pages/AccountPage'))
const VendorDashboard   = lazy(() => import('./pages/vendor/VendorDashboard'))
const DriverDashboard   = lazy(() => import('./pages/driver/DriverDashboard'))
const AdminDashboard    = lazy(() => import('./pages/admin/AdminDashboard'))
const DriverRegisterPage      = lazy(() => import('./pages/DriverRegisterPage'))
const SellerRegisterPage      = lazy(() => import('./pages/SellerRegisterPage'))
const CommercialRegisterPage  = lazy(() => import('./pages/CommercialRegisterPage'))
const CommercialDashboard     = lazy(() => import('./pages/commercial/CommercialDashboard'))
const B2BRegisterPage    = lazy(() => import('./pages/B2BRegisterPage'))
const B2BMarketplacePage = lazy(() => import('./pages/B2BMarketplacePage'))
const B2BDashboard       = lazy(() => import('./pages/b2b/B2BDashboard'))
const AccountingDashboard = lazy(() => import('./pages/accounting/AccountingDashboard'))
const ContactPage       = lazy(() => import('./pages/info/ContactPage'))
const LivraisonsPage    = lazy(() => import('./pages/info/LivraisonsPage'))
const CguPage           = lazy(() => import('./pages/info/CguPage'))
const PrivacyPage       = lazy(() => import('./pages/info/PrivacyPage'))
const TarifsPage        = lazy(() => import('./pages/info/TarifsPage'))
const AidePage          = lazy(() => import('./pages/info/AidePage'))
const RetourPage        = lazy(() => import('./pages/info/RetourPage'))
const GuidePage         = lazy(() => import('./pages/info/GuidePage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'))
const VerifyEmailPage    = lazy(() => import('./pages/VerifyEmailPage'))

const Loader = () => (
  <div className="min-h-screen bg-cream flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
  </div>
)

function PrivateRoute({ children, role }) {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/auth" replace />
  if (role) {
    const allowed = Array.isArray(role) ? role : [role]
    // LOT 11 (Arbitrage XXX RIZ) : une capacité B2B activée (LOT2 —
    // UserCapability, ex. un BUYER devenu aussi TRADER) ne change jamais
    // User.role, seul le rôle PRINCIPAL — sans ce repli, PrivateRoute
    // renvoyait systématiquement vers "/" un utilisateur qui venait
    // pourtant d'activer la capacité avec succès (backend déjà correct,
    // requireRole() honore les deux depuis LOT2 ; seul le routeur frontend
    // ne le savait pas). GET /me inclut déjà chaque relation de profil
    // (user.trader, user.cooperative, ...) quand la capacité existe.
    const hasCapability = allowed.some(r => Boolean(user[r.toLowerCase()]))
    if (!allowed.includes(user.role) && !hasCapability) return <Navigate to="/" replace />
  }
  return children
}

function AppRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/"              element={<HomePage />} />
        <Route path="/shop"          element={<ShopPage />} />
        <Route path="/shop/:id"      element={<ShopDetailPage />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/auth"          element={<LoginPage />} />
        <Route path="/cart"          element={<CartPage />} />

        <Route path="/checkout" element={
          <PrivateRoute><CheckoutPage /></PrivateRoute>
        } />
        <Route path="/orders" element={
          <PrivateRoute><MyOrdersPage /></PrivateRoute>
        } />
        <Route path="/messages" element={
          <PrivateRoute><MessagesPage /></PrivateRoute>
        } />
        <Route path="/support" element={
          <PrivateRoute><SupportPage /></PrivateRoute>
        } />
        <Route path="/account" element={
          <PrivateRoute><AccountPage /></PrivateRoute>
        } />

        <Route path="/wishlist" element={<Navigate to="/account?tab=wishlist" replace />} />

        <Route path="/vendor" element={
          <PrivateRoute role="SELLER"><VendorDashboard /></PrivateRoute>
        } />
        <Route path="/driver" element={
          <PrivateRoute role="DRIVER"><DriverDashboard /></PrivateRoute>
        } />
        <Route path="/admin" element={
          <PrivateRoute role="ADMIN"><AdminDashboard /></PrivateRoute>
        } />

        <Route path="/register" element={<BuyerRegisterPage />} />
        <Route path="/register/driver" element={<DriverRegisterPage />} />
        <Route path="/register/seller" element={<SellerRegisterPage />} />
        <Route path="/commercial/register" element={<CommercialRegisterPage />} />
        <Route path="/commercial" element={
          <PrivateRoute role={['ADMIN', 'COMMERCIAL']}><CommercialDashboard /></PrivateRoute>
        } />

        <Route path="/register/b2b"    element={<B2BRegisterPage />} />
        <Route path="/b2b/marketplace" element={<B2BMarketplacePage />} />
        <Route path="/producer" element={
          <PrivateRoute role="PRODUCER"><B2BDashboard /></PrivateRoute>
        } />
        <Route path="/cooperative" element={
          <PrivateRoute role="COOPERATIVE"><B2BDashboard /></PrivateRoute>
        } />
        <Route path="/trader" element={
          <PrivateRoute role="TRADER"><B2BDashboard /></PrivateRoute>
        } />
        <Route path="/processor" element={
          <PrivateRoute role="PROCESSOR"><B2BDashboard /></PrivateRoute>
        } />
        <Route path="/exporter" element={
          <PrivateRoute role="EXPORTER"><B2BDashboard /></PrivateRoute>
        } />
        <Route path="/accounting" element={
          <PrivateRoute role={['ACCOUNTANT', 'ADMIN']}><AccountingDashboard /></PrivateRoute>
        } />

        <Route path="/contact"         element={<ContactPage />} />
        <Route path="/livraisons"      element={<LivraisonsPage />} />
        <Route path="/cgu"             element={<CguPage />} />
        <Route path="/confidentialite" element={<PrivacyPage />} />
        <Route path="/cookies"         element={<CguPage />} />
        <Route path="/tarifs"          element={<TarifsPage />} />
        <Route path="/aide"            element={<AidePage />} />
        <Route path="/retours"         element={<RetourPage />} />
        <Route path="/guide"           element={<GuidePage />} />

        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/verify-email"    element={<VerifyEmailPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <SEOProvider>
              <CartProvider>
                <AppRoutes />
                <OfflineBanner />
              </CartProvider>
            </SEOProvider>
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  )
}
