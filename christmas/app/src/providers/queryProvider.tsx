"use client";

import React, { FC, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "react-query";

const Provider: FC<{ children: ReactNode }> = ({ children }) => {
    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

export default Provider;
