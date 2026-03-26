import { Layout } from "@/components/layout/Layout";
import { WebRTCDiagnostics } from "@/components/WebRTCDiagnostics";

export default function TestPage() {
  return (
    <Layout isAuthenticated>
      <WebRTCDiagnostics />
    </Layout>
  );
}

