import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { CaseProvider } from "./context/CaseContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import "./styles.css";
import "./reference-matches-fix.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <CaseProvider>
        <App />
      </CaseProvider>
    </ToastProvider>
  </React.StrictMode>,
);
