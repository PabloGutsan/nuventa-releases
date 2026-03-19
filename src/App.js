// src/App.js — versión actualizada con flujo de licencia + T&C + forzar cambio de contraseña
import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useDatabase } from './context/DatabaseContext';
import { usePermissions } from './hooks/usePermissions';
import Login from './pages/Auth/Login';
import ForceChangePassword from './pages/Auth/ForceChangePassword';
import TermsAcceptance from './pages/Onboarding/TermsAcceptance';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import ProductList from './pages/Inventory/ProductList';
import SalesHistory from './pages/Sales/SalesHistory';
import BusinessSettings from './pages/Settings/BusinessSettings';
import UsersList from './pages/Users/UsersList';
import POSMain from './pages/POS/POSMain';
import CashHistory from './pages/Cash/CashHistory';
import SupplierList from './pages/Suppliers/SupplierList';
import CustomerList from './pages/Customers/CustomerList';
import Reports from './pages/Reports/Reports';
import LicenseActivation from './pages/License/LicenseActivation';
import UpdateBanner from './components/common/UpdateBanner';
import PurchaseHistory from './pages/Inventory/PurchaseHistory';
import PromotionList from './pages/Promotions/PromotionList';

import './App.css';

// ── Pantalla de carga inicial ─────────────────────────────────────────────────
const SplashScreen = () => (
    <div style={{
        display: 'flex', justifyContent: 'center',
        alignItems: 'center', height: '100vh',
        backgroundColor: '#f8f9ff', flexDirection: 'column', gap: '16px'
    }}>
        <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #1E1B4B 0%, #4F46E5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', boxShadow: '0 8px 24px rgba(79,70,229,0.3)'
        }}>🏪</div>
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#1E1B4B' }}>Nuventa</div>
            <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>Inicializando...</div>
        </div>
        <div style={{
            width: '36px', height: '36px',
            border: '3px solid #e5e7eb', borderTop: '3px solid #4F46E5',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginTop: '8px'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

// ── Pantalla acceso denegado ──────────────────────────────────────────────────
const AccessDenied = ({ onNavigate, defaultSection }) => (
    <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '60vh', gap: '16px', color: '#6b7280'
    }}>
        <div style={{ fontSize: '64px' }}>🔒</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>
            Acceso restringido
        </h2>
        <p style={{ fontSize: '15px', margin: 0, textAlign: 'center', maxWidth: '360px' }}>
            No tienes permisos para ver esta sección.
            Contacta al administrador si crees que es un error.
        </p>
        <button
            onClick={() => onNavigate(defaultSection)}
            style={{
                marginTop: '8px', padding: '10px 24px', background: '#2563eb',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer'
            }}
        >
            Ir al inicio
        </button>
    </div>
);

// ── App autenticada ───────────────────────────────────────────────────────────
function AuthenticatedApp() {
    const { currentUser, logout } = useAuth();
    const { canAccess, defaultSection, salesFilter } = usePermissions();
    const [currentSection, setCurrentSection] = useState(defaultSection);

    const confirmNavigate = (section) => {
        if (canAccess(section)) setCurrentSection(section);
    };

    const handleNavigate = (section) => {
        if (!canAccess(section)) return;
        if (typeof window.__requestNavigate === 'function') {
            window.__requestNavigate(section);
        } else {
            setCurrentSection(section);
        }
    };

    const renderSection = () => {
        if (!canAccess(currentSection)) {
            return <AccessDenied onNavigate={handleNavigate} defaultSection={defaultSection} />;
        }
        switch (currentSection) {
            case 'dashboard':  return <Dashboard onNavigate={handleNavigate} />;
            case 'pos':        return <POSMain onNavigate={handleNavigate} />;
            case 'ventas':     return <SalesHistory salesFilter={salesFilter} currentUser={currentUser} />;
            case 'products':   return <ProductList />;
            case 'promotions': return <PromotionList />;
            case 'compras':    return <PurchaseHistory />;
            case 'suppliers':  return <SupplierList />;
            case 'customers':  return <CustomerList />;
            case 'reports':    return <Reports />;
            case 'caja':       return <CashHistory />;
            case 'users':      return <UsersList />;
            case 'settings':   return <BusinessSettings onNavigate={confirmNavigate} />;
            default:           return <Dashboard onNavigate={handleNavigate} />;
        }
    };

    return (
        <>
            <UpdateBanner />
            <MainLayout
                user={currentUser}
                onLogout={logout}
                currentSection={currentSection}
                onNavigate={handleNavigate}
            >
                {renderSection()}
            </MainLayout>
        </>
    );
}

// ── App raíz ──────────────────────────────────────────────────────────────────
function App() {
    const { currentUser, login, loading: authLoading } = useAuth();
    const { isLoading: dbLoading } = useDatabase();

    // null = verificando | true = aceptados | false = pendientes
    const [termsAccepted,      setTermsAccepted]      = useState(null);
    const [licenseStatus,      setLicenseStatus]      = useState('checking');
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [pendingUser,        setPendingUser]         = useState(null);

    // ── 1. Verificar T&C (primer arranque) ───────────────────────────────────
    useEffect(() => {
        const checkTerms = async () => {
            try {
                const accepted = await window.electronAPI.invoke('terms:accepted');
                setTermsAccepted(!!accepted);
            } catch {
                setTermsAccepted(true);
            }
        };
        checkTerms();
    }, []);

    // ── 2. Verificar licencia al arrancar ─────────────────────────────────────
    useEffect(() => {
        if (!window.electronAPI?.license) {
            setLicenseStatus('licensed');
            return;
        }
        const verifyLicense = async () => {
            try {
                const result = await window.electronAPI.license.check();
                if (result.hasLicense && result.isActive) {
                    console.log('[App] Licencia local válida para:', result.businessName);
                    setLicenseStatus('licensed');
                } else {
                    console.log('[App] Sin licencia activa, mostrando activación');
                    setLicenseStatus('unlicensed');
                }
            } catch (error) {
                console.error('[App] Error verificando licencia:', error);
                setLicenseStatus('licensed');
            }
        };
        verifyLicense();
    }, []);

    // ── 3. Escuchar revocación periódica de licencia (cada 60 min) ───────────
    useEffect(() => {
        if (!window.electronAPI?.license?.onRevoked) return;
        const unsub = window.electronAPI.license.onRevoked((data) => {
            console.warn('[App] Licencia revocada en tiempo real:', data.reason);
            setLicenseStatus('unlicensed');
        });
        return () => unsub?.();
    }, []);

    // ── 4. Login con detección de must_change_password ───────────────────────
    const handleLogin = async (username, password) => {
        try {
            const result = await login(username, password);

            console.log('LOGIN RESULT COMPLETO:', JSON.stringify(result));
            console.log('must_change_password:', result.user?.must_change_password);

            if (!result.success) return result;

            const mustChange = result.user?.must_change_password;
            console.log('mustChange valor:', mustChange, 'tipo:', typeof mustChange);

            if (mustChange === 1 || mustChange === true) {
                console.log('✅ ACTIVANDO ForceChangePassword');
                setPendingUser(result.user);
                setMustChangePassword(true);
            } else {
                console.log('❌ NO se activó ForceChangePassword');
            }

            return { success: true };
        } catch (error) {
            console.error('[App] Error en login:', error);
            return { success: false, error: error.message };
        }
    };

    const handlePasswordChanged = () => {
        setMustChangePassword(false);
        setPendingUser(null);
    };

    // ── Render — orden de prioridad ───────────────────────────────────────────

    // Esperando verificaciones iniciales
    if (termsAccepted === null || licenseStatus === 'checking' || dbLoading || authLoading) {
        return <SplashScreen />;
    }

    // 1. Primera vez — T&C antes que todo
    if (!termsAccepted) {
        return <TermsAcceptance onAccepted={() => setTermsAccepted(true)} />;
    }

    // 2. Sin licencia activa
    if (licenseStatus === 'unlicensed') {
        return (
            <LicenseActivation
                onActivated={(data) => {
                    console.log('[App] Licencia activada:', data);
                    setLicenseStatus('licensed');
                }}
            />
        );
    }

    // 3. Sin sesión iniciada
    if (!currentUser) {
        return <Login onLogin={handleLogin} />;
    }

    // 4. Primer login — forzar cambio de contraseña
    if (mustChangePassword && pendingUser) {
        return (
            <ForceChangePassword
                user={pendingUser}
                onPasswordChanged={handlePasswordChanged}
            />
        );
    }

    // 5. App normal
    return <AuthenticatedApp />;
}

export default App;