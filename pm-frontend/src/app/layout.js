import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { AuthProvider } from "@/app/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata = {
  title: "Preventive Maintenance Log",
  description: "RGA Preventive Maintenance Log Monitoring System",
  icons: {
    icon: "/ghost.ico",
    shortcut: "/ghost.ico",
    apple: "/ghost.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ProtectedRoute>{children}</ProtectedRoute>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
