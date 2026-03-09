// Detecta si la app corre en macOS
export const isMac = () => {
    if (typeof window !== 'undefined' && window.electronAPI?.platform) {
        return window.electronAPI.platform === 'darwin';
    }
    return navigator.platform.toUpperCase().includes('MAC');
};

// Retorna el label correcto según plataforma
export const getShortcutLabel = (windowsKey, macKey) => {
    return isMac() ? macKey : windowsKey;
};