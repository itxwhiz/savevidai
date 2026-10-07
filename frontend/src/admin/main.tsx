import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Admin } from "./Admin";
import { adminUrl } from "../lib/backend";
import "../styles/index.css";

const destination = adminUrl(window.location.origin);
if (destination) {
  window.location.replace(destination);
} else {
  createRoot(document.getElementById("admin-root")!).render(
    <StrictMode>
      <Admin />
    </StrictMode>,
  );
}
