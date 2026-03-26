import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Bell, User, Menu, X, Sparkles, MapPin, CalendarDays, ShieldAlert, Crown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface NavbarProps {
  isAuthenticated?: boolean;
}

export const Navbar = ({ isAuthenticated = false }: NavbarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { unreadNotifications } = useNotifications();
  const { isAdmin, isManager } = useCurrentUser();
  const unreadCount = unreadNotifications.length;

  const navLinks = isAuthenticated
    ? [
        { to: "/discover", label: "Discover", icon: Sparkles },
        { to: "/matches", label: "Matches", icon: Heart },
        { to: "/messages", label: "Chat", icon: MessageCircle, badge: 3 },
        { to: "/date-spots", label: "Date Spots", icon: MapPin },
        ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldAlert }] : []),
        ...(isManager ? [{ to: "/manager/revenue", label: "Revenue", icon: TrendingUp }] : []),
        { to: "/appointments", label: "Appointments", icon: CalendarDays },
        { to: "/notifications", label: "Notifications", icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
        { to: "/premium", label: "Premium", icon: Crown },
        { to: "/profile", label: "Profile", icon: User },
      ]
    : [];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center gradient-primary text-white font-bold text-xl shadow-md transform -rotate-6 group-hover:rotate-0 transition-all duration-300">
              <Heart className="w-6 h-6 text-white fill-current" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">Heartly</span>
          </Link>

          {/* Desktop Navigation */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <Link key={link.to} to={link.to}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "relative rounded-full font-bold transition-all px-4",
                        isActive ? "bg-red-50 text-[#ff416c]" : "hover:bg-gray-50 text-muted-foreground"
                      )}
                    >
                      <link.icon className="w-5 h-5 mr-2" />
                      <span className="hidden lg:inline">{link.label}</span>
                      {link.badge && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center gradient-primary text-[10px] border-0 text-white font-bold">
                          {link.badge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Auth Buttons */}
          {!isAuthenticated && (
            <div className="hidden md:flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost" className="font-bold text-base hover:bg-gray-50 rounded-full px-6 transition-all">
                  Log in
                </Button>
              </Link>
              <Link to="/register">
                <Button className="gradient-primary text-white hover:scale-105 transition-all duration-300 font-bold rounded-full px-8 shadow-glow border-0">
                  Get Started
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-b border-border"
          >
            <div className="container mx-auto px-4 py-4 space-y-2">
              {isAuthenticated ? (
                navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsOpen(false)}
                  >
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3"
                    >
                      <link.icon className="w-5 h-5" />
                      {link.label}
                      {link.badge && (
                        <Badge className="ml-auto gradient-primary border-0">
                          {link.badge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                ))
              ) : (
                <>
                  <Link to="/login" onClick={() => setIsOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start rounded-full font-bold">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setIsOpen(false)}>
                    <Button className="w-full justify-center gradient-primary text-white font-bold shadow-glow border-0 rounded-full mt-2">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
