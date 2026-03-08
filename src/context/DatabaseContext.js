import React, { createContext, useContext, useState, useEffect } from 'react';
import db from '../services/database/db';

const DatabaseContext = createContext();

export const DatabaseProvider = ({ children }) => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        initializeDatabase();
    }, []);

    const initializeDatabase = async () => {
        try {
            setIsLoading(true);
            await db.initialize();
            setIsInitialized(true);
            setError(null);
        } catch (err) {
            console.error('Error initializing database:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const query = (sql, params = []) => {
        if (!isInitialized) {
            throw new Error('Database not initialized');
        }
        return db.query(sql, params);
    };

    const run = (sql, params = []) => {
        if (!isInitialized) {
            throw new Error('Database not initialized');
        }
        return db.run(sql, params);
    };

    return (
        <DatabaseContext.Provider value={{ 
            isInitialized, 
            isLoading, 
            error, 
            query, 
            run,
            db 
        }}>
            {children}
        </DatabaseContext.Provider>
    );
};

export const useDatabase = () => {
    const context = useContext(DatabaseContext);
    if (!context) {
        throw new Error('useDatabase must be used within DatabaseProvider');
    }
    return context;
};