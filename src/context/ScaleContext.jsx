import React, { createContext, useState, useContext } from 'react';

export const ScaleContext = createContext(null);

export const ScaleProvider = ({ children }) => {
    const [scale, setScale] = useState(1.0);
    const value = { scale, setScale };
    return <ScaleContext.Provider value={value}>{children}</ScaleContext.Provider>;
};

export const useScale = () => useContext(ScaleContext);
