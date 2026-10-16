import "@/index.css";
import "@/styles/joy-tailwind-bridge.css";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { CssVarsProvider, CssBaseline, Box, Typography } from "@mui/joy";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CustomerIntelligencePage from "@/pages/crm/CustomerIntelligencePage";
function BloomMock() {
  const location = useLocation();
  return (
    <main style={{ padding: 40 }}>
      <Typography level="h2">Bloom conversation</Typography>
      <Box data-testid="bloom-url">{location.pathname + location.search}</Box>
    </main>
  );
}
function App() {
  const queryClient = React.useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    [],
  );
  return (
    <CssVarsProvider>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/crm/intelligence"]}>
          <Routes>
            <Route
              path="/crm/intelligence"
              element={<CustomerIntelligencePage />}
            />
            <Route path="/bloom" element={<BloomMock />} />
            <Route
              path="/crm/customers/:id"
              element={<main>Recorded customer purchase detail</main>}
            />
            <Route
              path="/crm/segments"
              element={<main>Segment builder</main>}
            />
            <Route path="/crm/pos" element={<main>POS integrations</main>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </CssVarsProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
