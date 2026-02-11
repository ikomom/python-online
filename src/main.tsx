import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import "./styles/index.scss";
import App from "./App";
import { setupMonaco } from "./monaco/setupMonaco";

setupMonaco();

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root"),
);
