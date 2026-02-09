"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  User,
  Moon,
  NotepadText,
  MonitorCog,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";

export default function AppLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const userMenuRef = useRef(null);

  // Check if current page is public QR view
  const isPublicView = pathname === "/pm-history";

  // Define all menu items
  const allMenuItems = [
    {
      id: "pm-logs",
      label: "PM Logs",
      icon: NotepadText,
      href: "/pm-logs",
      roles: ["admin", "user"], // Both roles can access
    },
    {
      id: "pm-configuration",
      label: "PM Configuration",
      icon: MonitorCog,
      href: "/pm-configuration",
      roles: ["admin", "user"], // Both roles can access
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      href: "/settings",
      roles: ["admin"], // Admin only
    },
  ];

  // Filter menu items based on user role
  const menuItems = allMenuItems.filter((item) => {
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavigation = (item) => {
    router.push(item.href);
  };

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
  };

  const isActive = (href) => {
    if (!href) return false;
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Get initials from user's name
  const getInitials = () => {
    if (!user) return "U";
    const firstInitial = user.firstName?.charAt(0) || "";
    const lastInitial = user.lastName?.charAt(0) || "";
    return (firstInitial + lastInitial).toUpperCase() || "U";
  };

  // Get full name
  const getFullName = () => {
    if (!user) return "User Name";
    const middleInitial = user.middleName
      ? ` ${user.middleName.charAt(0)}.`
      : "";
    return `${user.firstName}${middleInitial} ${user.lastName}`;
  };

  // Get position
  const getPosition = () => {
    return user?.position || "No position";
  };

  // If it's a public view, render without sidebar
  if (isPublicView) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`${
          isCollapsed ? "w-16" : "w-64"
        } bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out flex flex-col`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <Image src="/ghost.ico" alt="ghost-logo" width={24} height={24} />
              <h1 className="text-lg font-semibold text-sidebar-foreground">
                PM Log System
              </h1>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight size={20} />
            ) : (
              <ChevronLeft size={20} />
            )}
          </button>
        </div>

        {/* Menu Items - Filtered by role */}
        <nav className="flex-1 p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer - User Profile with Dropdown Menu */}
        <div className="p-2 border-t border-sidebar-border" ref={userMenuRef}>
          {loading ? (
            <div
              className={`flex items-center gap-3 p-2 ${
                isCollapsed ? "justify-center" : ""
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-sidebar-accent animate-pulse flex-shrink-0" />
              {!isCollapsed && (
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-sidebar-accent rounded animate-pulse w-24" />
                  <div className="h-3 bg-sidebar-accent rounded animate-pulse w-32" />
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors ${
                  isCollapsed ? "justify-center" : ""
                }`}
                title={
                  isCollapsed
                    ? `${getFullName()} - ${user?.position}`
                    : undefined
                }
              >
                {/* Profile Picture or Avatar */}
                <div className="relative w-8 h-8 flex-shrink-0">
                  {user?.profilePicture && user.profilePicture.trim() !== "" ? (
                    <Image
                      src={`${process.env.NEXT_PUBLIC_API_URL || "http://172.16.21.12:4000"}/${user.profilePicture}`}
                      alt={getFullName()}
                      fill
                      className="rounded-lg object-cover"
                      sizes="32px"
                      unoptimized
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-xs font-semibold">
                      {getInitials()}
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {getFullName()}
                      </p>
                      <p className="text-xs text-sidebar-foreground/70 truncate">
                        {getPosition()}
                      </p>
                    </div>
                    <ChevronsUpDown
                      size={16}
                      className="text-sidebar-foreground/50 flex-shrink-0"
                    />
                  </>
                )}
              </button>

              {/* Dropdown Menu - Appears above the user profile */}
              {isUserMenuOpen && !isCollapsed && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-sidebar border border-sidebar-border rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="py-1.5">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        router.push("/profile");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    >
                      <User size={16} className="flex-shrink-0" />
                      <span>Account</span>
                    </button>
                  </div>
                  <div className="border-t border-sidebar-border" />
                  <div className="py-1.5">
                    {/* Dark Mode Toggle */}
                    <div className="flex items-center justify-between px-3 py-2 text-sm text-sidebar-foreground">
                      <div className="flex items-center gap-3">
                        <Moon size={16} className="flex-shrink-0" />
                        <span>Dark Mode</span>
                      </div>
                      <Switch
                        checked={theme === "dark"}
                        onCheckedChange={(checked) =>
                          setTheme(checked ? "dark" : "light")
                        }
                      />
                    </div>
                  </div>
                  <div className="border-t border-sidebar-border" />
                  <div className="py-1.5">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    >
                      <LogOut size={16} className="flex-shrink-0" />
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
