import QiblaAppUI from "@/components/QiblaAppUI";
import { Toaster } from "sonner";

function App() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-foreground">
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          style: {
            background: "rgba(13, 13, 43, 0.95)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            color: "#fff",
            backdropFilter: "blur(12px)",
          },
        }}
      />
      <QiblaAppUI />
    </div>
  );
}

export default App;