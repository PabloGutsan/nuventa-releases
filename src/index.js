import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { DatabaseProvider } from './context/DatabaseContext';
import { AuthProvider } from './context/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DatabaseProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DatabaseProvider>
  </React.StrictMode>
);