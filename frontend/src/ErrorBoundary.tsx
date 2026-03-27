import React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const mask = (s: string | undefined) => {
        if (!s) return "(không có)";
        const last = s.slice(-6);
        return s.length > 10 ? "*****" + last : s;
      };

      // Message in Vietnamese
      return (
        <div style={{ padding: 20, fontFamily: "Inter, Roboto, sans-serif" }}>
          <h2>Lỗi khởi tạo Clerk</h2>
          <p>
            Có lỗi khi khởi tạo <strong>Clerk</strong>. Vui lòng kiểm tra biến môi
            trường <code>VITE_CLERK_PUBLISHABLE_KEY</code> trong file <code>.env</code>.
          </p>
          <p>
            Khóa hiện tại: <code>{mask(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)}</code>
          </p>
          <p>
            Lấy Publishable key tại: <a href="https://dashboard.clerk.com/last-active?path=api-keys" target="_blank" rel="noreferrer">dashboard.clerk.com</a>
          </p>
          <pre style={{ background: "#f8f8f8", padding: 12 }}>{String(this.state.error)}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
