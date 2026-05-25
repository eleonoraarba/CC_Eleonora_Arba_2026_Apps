import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "react-oidc-context";
import App from "./App.jsx";
import { OIDC_CONFIG } from "./config";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <AuthProvider {...OIDC_CONFIG}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
