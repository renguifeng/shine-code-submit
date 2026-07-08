// React 入口:挂载 <App/> 到 #root。
import { createRoot } from "react-dom/client";
import { App } from "./components/App";

createRoot(document.getElementById("root")!).render(<App />);
