import { Layout } from "@/components/Layout";
import { Toaster } from "sonner";

function App() {
  return (
    <>
      <Layout />
      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
