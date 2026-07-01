import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { AuthProvider } from "@/app/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

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
            <TooltipProvider>
              <ProtectedRoute>{children}</ProtectedRoute>
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
