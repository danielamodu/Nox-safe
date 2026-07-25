import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { ConnectPage } from "./pages/ConnectPage";
import { Dashboard } from "./pages/Dashboard";
import { Setup } from "./pages/Setup";
import { SubmitIntent } from "./pages/SubmitIntent";
import { SablierShield } from "./pages/SablierShield";
import { IntentHistory } from "./pages/IntentHistory";
import { PolicyView } from "./pages/PolicyView";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/app" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="setup" element={<Setup />} />
          <Route path="submit" element={<SubmitIntent />} />
          <Route path="sablier" element={<SablierShield />} />
          <Route path="history" element={<IntentHistory />} />
          <Route path="policy" element={<PolicyView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
