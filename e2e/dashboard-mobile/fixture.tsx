import * as React from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, CssVarsProvider } from "@mui/joy";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BloomSuiteDashboard } from "@/pages/BloomSuiteDashboard";
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const destinations = [
  "/newsletters/new",
  "/sms/new",
  "/crm/customers",
  "/analytics",
];
function App() {
  return (
    <CssVarsProvider>
      <CssBaseline />
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<BloomSuiteDashboard />} />
            {destinations.map((route) => (
              <Route
                key={route}
                path={route}
                element={<main data-testid="destination">Opened: {route}</main>}
              />
            ))}
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </CssVarsProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
