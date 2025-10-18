import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import MainBin from "./components/MainBin";
import TrashView from "./components/TrashView";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Router>
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<MainBin />} />
            <Route path="/t/:id" element={<TrashView />} />
          </Routes>
        </div>
        <Footer />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#ffffff",
              color: "#374151",
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
              fontSize: "14px",
              boxShadow:
                "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            },
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#ffffff",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#ffffff",
              },
            },
          }}
        />
      </Router>
    </div>
  );
}
