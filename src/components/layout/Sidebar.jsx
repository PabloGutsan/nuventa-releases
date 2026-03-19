// src/components/layout/Sidebar.jsx
import React from 'react';
import {
    FiHome, FiShoppingCart, FiPackage, FiBarChart2,
    FiUsers, FiSettings, FiChevronLeft, FiChevronRight,
    FiList, FiTruck, FiUser, FiDollarSign, FiBriefcase,
    FiTag,
} from 'react-icons/fi';
import { usePermissions } from '../../hooks/usePermissions';
import './Sidebar.css';

// ── Definición completa de items — el filtro la recorta según rol ─────────────
const ALL_MENU_ITEMS = [
    { id: 'dashboard',   icon: FiHome,         label: 'Dashboard'           },
    { id: 'pos',         icon: FiShoppingCart,  label: 'Punto de Venta'      },
    { id: 'ventas',      icon: FiList,          label: 'Historial de Ventas'  },
    { id: 'products',    icon: FiPackage,       label: 'Inventario'           },
    { id: 'compras',     icon: FiTruck,         label: 'Historial Compras'    },
    { id: 'suppliers',   icon: FiBriefcase,     label: 'Proveedores'          },
    { id: 'promotions',  icon: FiTag,           label: 'Promociones'          },
    { id: 'customers',   icon: FiUser,          label: 'Clientes'             },
    { id: 'reports',     icon: FiBarChart2,     label: 'Reportes'             },
    { id: 'caja',        icon: FiDollarSign,    label: 'Historial de Cajas'   },
    { id: 'users',       icon: FiUsers,         label: 'Usuarios'             },
];

const SETTINGS_ITEM = { id: 'settings', icon: FiSettings, label: 'Configuración' };

const Sidebar = ({ isOpen, onToggle, currentSection, onNavigate }) => {
    const { canAccess } = usePermissions();

    const visibleItems = ALL_MENU_ITEMS.filter(item => canAccess(item.id));
    const showSettings = canAccess(SETTINGS_ITEM.id);

    const renderMenuItem = (item) => {
        const Icon = item.icon;
        const isActive = currentSection === item.id;
        return (
            <button
                key={item.id}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
                title={!isOpen ? item.label : ''}
            >
                <Icon className="sidebar-icon" />
                {isOpen && <span className="sidebar-label">{item.label}</span>}
            </button>
        );
    };

    return (
        <div className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <nav className="sidebar-nav">
                {visibleItems.map(renderMenuItem)}
            </nav>
            <button className="sidebar-toggle" onClick={onToggle}>
                {isOpen ? <FiChevronLeft /> : <FiChevronRight />}
            </button>
            <div className="sidebar-footer">
                {showSettings && renderMenuItem(SETTINGS_ITEM)}
            </div>
        </div>
    );
};

export default Sidebar;