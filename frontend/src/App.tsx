import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { NoxPayLayout } from "./components/NoxPayLayout";
import { Landing } from "./pages/Landing";
import { ProductSelect } from "./pages/ProductSelect";
import { ConnectPage } from "./pages/ConnectPage";
import { Dashboard } from "./pages/Dashboard";
import { Setup } from "./pages/Setup";
import { SubmitIntent } from "./pages/SubmitIntent";
import { IntentHistory } from "./pages/IntentHistory";
import { PolicyView } from "./pages/PolicyView";
import { NoxPayCreate } from "./pages/NoxPayCreate";
import { NoxPayStreams } from "./pages/NoxPayStreams";
import { NoxPayWithdraw } from "./pages/NoxPayWithdraw";
import { Docs } from "./pages/Docs";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/products" element={<ProductSelect />} />
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        {/* Nox-Safe (treasury) */}
        <Route path="/app/safe" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="setup" element={<Setup />} />
          <Route path="submit" element={<SubmitIntent />} />
          <Route path="history" element={<IntentHistory />} />
          <Route path="policy" element={<PolicyView />} />
        </Route>

        {/* NoxPay (payroll streaming) */}
        <Route path="/app/pay" element={<NoxPayLayout />}>
          <Route index element={<NoxPayCreate />} />
          <Route path="streams" element={<NoxPayStreams />} />
          <Route path="withdraw" element={<NoxPayWithdraw />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
