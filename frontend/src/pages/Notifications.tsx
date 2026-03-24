import { motion } from "framer-motion";
import { Bell, Heart, MessageCircle, Calendar, Star, UserCheck, Settings } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
const getIconColor = (type: string) => {
  switch (type) {
    case "new_match":
    case "match":
      return "bg-primary text-primary-foreground";
    case "new_message":
    case "message":
      return "bg-blue-500 text-white";
    case "connection_liked":
    case "like":
      return "bg-gold text-white";
    case "upcoming_appointment":
    case "appointment":
      return "bg-success text-white";
    case "verification":
      return "bg-green-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "new_match": return Heart;
    case "new_message": return MessageCircle;
    case "connection_liked": return Star;
    case "upcoming_appointment": return Calendar;
    default: return Bell;
  }
};

export default function Notifications() {
  const navigate = useNavigate();
  const { allNotifications, unreadNotifications, isLoadingAll, markAsRead } = useNotifications();
  const unreadCount = unreadNotifications.length;

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.isRead) {
      markAsRead.mutate(n.id);
    }

    if (n.type === "new_message" && n.data?.senderUserId) {
      navigate("/messages", {
        state: {
          selectedConversationId: n.data.senderUserId,
        },
      });
    }
  };

  const mappedNotifications = allNotifications.map((n) => {
    const Icon = getNotificationIcon(n.type);
    return {
      id: n.id,
      original: n,
      type: n.type,
      icon: Icon,
      title: n.type === "new_match" ? "New Match!" : n.type.replace("_", " ").toUpperCase(),
      message: n.content,
      time: formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }),
      read: n.isRead,
      image: n.data?.matchedUserAvatar || n.data?.senderAvatar || null,
    };
  });

  return (
    <Layout isAuthenticated>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-2">
                <Bell className="w-8 h-8 text-primary" />
                Notifications
              </h1>
              <p className="text-muted-foreground mt-1">
                {isLoadingAll
                  ? "Loading..."
                  : unreadCount > 0
                  ? `${unreadCount} new notifications`
                  : "You're all caught up!"}
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          {/* Notifications List */}
          <div className="space-y-3">
            {mappedNotifications.map((notification, i) => {
              const Icon = notification.icon;
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleNotificationClick(notification.original)}
                  className={cn(
                    "p-4 rounded-2xl flex items-start gap-4 cursor-pointer transition-colors",
                    notification.read
                      ? "bg-card hover:bg-secondary/50"
                      : "bg-coral-light/30 hover:bg-coral-light/50"
                  )}
                >
                  {/* Icon or Image */}
                  {notification.image ? (
                    <div className="relative">
                      <img
                        src={notification.image}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div
                        className={cn(
                          "absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center",
                          getIconColor(notification.type)
                        )}
                      >
                        <Icon className="w-3 h-3" />
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        getIconColor(notification.type)
                      )}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-foreground">{notification.title}</h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {notification.time}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                  </div>

                  {/* Unread Indicator */}
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full gradient-primary mt-2" />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Empty State */}
          {!isLoadingAll && mappedNotifications.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                <Bell className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                No notifications yet
              </h3>
              <p className="text-muted-foreground">
                When you get matches, messages, or likes, they'll appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
