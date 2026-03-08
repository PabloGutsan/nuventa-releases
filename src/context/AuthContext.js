import React, { createContext, useContext, useState, useEffect } from 'react';
import { useDatabase } from './DatabaseContext';
import AuthService from '../services/auth/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const { db, isInitialized } = useDatabase();
    const [authService, setAuthService] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isInitialized && db) {
            const service = new AuthService(db);
            setAuthService(service);
            
            // Verificar si hay sesión guardada
            const user = service.getCurrentUser();
            setCurrentUser(user);
            setLoading(false);
        }
    }, [isInitialized, db]);

    const login = async (username, password) => {
        if (!authService) {
            return { success: false, error: 'Sistema no inicializado' };
        }

        const result = await authService.login(username, password);
        if (result.success) {
            setCurrentUser(result.user);
        }
        return result;
    };

    const logout = () => {
        if (authService) {
            authService.logout();
            setCurrentUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{
            currentUser,
            login,
            logout,
            isAuthenticated: !!currentUser,
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};