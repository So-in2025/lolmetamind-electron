import React, { createContext, useContext, useState } from 'react';

export const AppStateContext = createContext(null);

export const AppStateProvider = ({ children }) => {
    const [state, setState] = useState({
        userData: null, 
        isLoadingUser: true,
        isFirstTimeUser: true,
        isAuthenticated: false,
    });

    return (
        <AppStateContext.Provider value={{ ...state, setAppState: setState }}>
            {children}
        </AppStateContext.Provider>
    );
};

export const useAppState = () => useContext(AppStateContext);
