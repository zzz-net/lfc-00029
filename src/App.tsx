import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Home from "@/pages/Home";
import Templates from "@/pages/Templates";
import TemplateEdit from "@/pages/TemplateEdit";
import Devices from "@/pages/Devices";
import Inspections from "@/pages/Inspections";
import InspectionForm from "@/pages/InspectionForm";
import Sync from "@/pages/Sync";
import Export from "@/pages/Export";
import Logs from "@/pages/Logs";
import StatusDesk from "@/pages/StatusDesk";
import SubmissionReceipt from "@/pages/SubmissionReceipt";
import SubmissionWorkbench from "@/pages/SubmissionWorkbench";
import { useStore } from "@/store/useStore";

function AppInitializer() {
  const { loadInitialData, seedDevices, isLoading } = useStore();

  useEffect(() => {
    const init = async () => {
      await loadInitialData();
      await seedDevices();
    };
    init();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="text-primary-600 animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/templates" element={<Templates />} />
      <Route path="/templates/new" element={<TemplateEdit />} />
      <Route path="/templates/:id" element={<TemplateEdit />} />
      <Route path="/devices" element={<Devices />} />
      <Route path="/inspections" element={<Inspections />} />
      <Route path="/inspections/:deviceId" element={<InspectionForm />} />
      <Route path="/status-desk" element={<StatusDesk />} />
      <Route path="/submission-workbench" element={<SubmissionWorkbench />} />
      <Route path="/record/:recordId/receipt" element={<SubmissionReceipt />} />
      <Route path="/sync" element={<Sync />} />
      <Route path="/export" element={<Export />} />
      <Route path="/logs" element={<Logs />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppInitializer />
    </Router>
  );
}
