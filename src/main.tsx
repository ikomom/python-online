import React from "react";
import ReactDOM from "react-dom";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import "./index.css";
import App from "./App";

// Configure Monaco to use local package instead of CDN to avoid COEP issues
loader.config({ monaco });

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root"),
);
