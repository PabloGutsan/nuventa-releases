// src/components/layout/MainLayout.jsx
// Cambio: currentSection y onNavigate ahora vienen como props desde App.js
// MainLayout ya no es dueño del estado de navegación — solo lo renderiza.

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import './MainLayout.css';

const MainLayout = ({ user, onLogout, currentSection, onNavigate, children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const handleToggleSidebar = () => setSidebarOpen(!sidebarOpen);

    return (
        <div className="app-container">
            <Sidebar
                isOpen={sidebarOpen}
                onToggle={handleToggleSidebar}
                currentSection={currentSection}
                onNavigate={onNavigate}
            />
            <div className={`main-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                <Header user={user} onLogout={onLogout} />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;