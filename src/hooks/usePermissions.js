// src/hooks/usePermissions.js
// ─────────────────────────────────────────────────────────────────────────────
// Hook central de permisos. Toda la lógica de acceso por rol vive aquí.
// Para cambiar permisos de un rol, solo editar ROLE_PERMISSIONS.
// ─────────────────────────────────────────────────────────────────────────────

import { useAuth } from '../context/AuthContext';

// ── Tabla de permisos por rol ─────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
    admin: {
        sections: ['dashboard', 'pos', 'ventas', 'products', 'compras', 'suppliers', 'customers', 'reports', 'caja', 'users', 'settings'],
        defaultSection: 'dashboard',
        salesFilter: 'all',      // ve todas las ventas
    },
    vendedor: {
        sections: ['dashboard', 'pos', 'ventas'],
        defaultSection: 'pos',
        salesFilter: 'own',      // solo sus ventas del día
    },
    inventario: {
        sections: ['products', 'compras', 'suppliers'],
        defaultSection: 'products',
        salesFilter: 'none',
    },
};

// Fallback si el rol no existe en la tabla
const FALLBACK_PERMISSIONS = {
    sections: ['dashboard'],
    defaultSection: 'dashboard',
    salesFilter: 'none',
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const usePermissions = () => {
    const { currentUser } = useAuth();

    const role = currentUser?.role || 'vendedor';
    const perms = ROLE_PERMISSIONS[role] || FALLBACK_PERMISSIONS;

    // ¿Puede acceder a una sección?
    const canAccess = (section) => perms.sections.includes(section);

    // ¿Qué filtro aplica al historial de ventas?
    const salesFilter = perms.salesFilter;

    // Sección inicial al loguearse
    const defaultSection = perms.defaultSection;

    // Lista de secciones permitidas (para el sidebar)
    const allowedSections = perms.sections;

    return {
        role,
        canAccess,
        salesFilter,
        defaultSection,
        allowedSections,
    };
};

export { ROLE_PERMISSIONS };