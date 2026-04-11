import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, MessageSquare, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { SMSStats } from "@/hooks/useSMSStats";

interface SMSRecentMessagesProps {
  messages: SMSStats["recentMessages"];
}

export const SMSRecentMessages: React.FC<SMSRecentMessagesProps> = ({
  messages,
}) => {
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-blue-50 text-blue-700 text-xs hover:bg-blue-50">
            Sent
          </Badge>
        );
      case "delivered":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 text-xs hover:bg-emerald-50">
            Delivered
          </Badge>
        );
      case "queued":
        return (
          <Badge className="bg-amber-50 text-amber-700 text-xs hover:bg-amber-50">
            Queued
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="text-xs">
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        );
    }
  };

  const maskPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `(${cleaned.slice(1, 4)}) ***-${cleaned.slice(7)}`;
    }
    if (cleaned.length >= 10) {
      return `(${cleaned.slice(0, 3)}) ***-${cleaned.slice(-4)}`;
    }
    return phone.replace(/.(?=.{4})/g, "*");
  };

  return (
    <Card
      id="messages"
      className="rounded-[28px] border border-gray-100 bg-white shadow-sm"
    >
      <CardHeader className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold text-gray-900">
            Recent Messages
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            A quick look at the latest SMS activity across your account.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 rounded-xl px-3 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => navigate("/sms/messages")}
        >
          View All
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-6">
        {messages.length === 0 ? (
          <div className="flex min-h-[112px] items-center justify-center rounded-[22px] border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            <MessageSquare className="mr-2 h-4 w-4" />
            No recent messages
          </div>
        ) : (
          <ScrollArea className="h-[320px] pr-4">
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-[22px] border border-gray-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {maskPhone(message.phone)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(message.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <p className="truncate text-sm text-gray-600">
                        “{message.content}”
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <div>{getStatusBadge(message.status)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
