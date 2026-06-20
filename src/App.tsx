import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Templates from "@/pages/Templates";
import TemplateEdit from "@/pages/TemplateEdit";
import Devices from "@/pages/Devices";
import Inspections from "@/pages/Inspections";
import InspectionForm from "@/pages/InspectionForm";
import Sync from "@/pages/Sync";
import Export from "@/pages/Export";
import Logs from "@/pages/Logs";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/templates/new" element={<TemplateEdit />} />
        <Route path="/templates/:id" element={<TemplateEdit />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/inspections" element={<Inspections />} />
        <Route path="/inspections/:deviceId" element={<InspectionForm />} />
        <Route path="/sync" element={<Sync />} />
        <Route path="/export" element={<Export />} />
        <Route path="/logs" element={<Logs />} />
      </Routes>
    </Router>
  );
}
