
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { SubscriptionProvider } from './contexts/SubscriptionContext.tsx'

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <SubscriptionProvider>
        <App />
      </SubscriptionProvider>
    </AuthProvider>
  </BrowserRouter>
);
