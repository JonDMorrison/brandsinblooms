import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageSquare,
  Search,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useSMSMessages } from "@/hooks/useSMSMessages";

type StatusFilter = "all" | "delivered" | "queued" | "failed" | "sent";

function maskPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ***-${cleaned.slice(7)}`;
  }
  if (cleaned.length >= 10) {
    return `(${cleaned.slice(0, 3)}) ***-${cleaned.slice(-4)}`;
  }
  return phone.replace(/.(?=.{4})/g, "*");
}

function getStatusBadge(status: string) {
  switch (status) {
    case "delivered":
      return (
        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
          Delivered
        </Badge>
      );
    case "queued":
      return (
        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">
          Queued
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "sent":
      return (
        <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">
          Sent
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function SMSMessagesPage() {
  const navigate = useNavigate();
  const { data: messages = [], isLoading } = useSMSMessages();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      const matchesStatus =
        statusFilter === "all" || message.status === statusFilter;
      const lowerSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !lowerSearch ||
        message.content.toLowerCase().includes(lowerSearch) ||
        message.phone.toLowerCase().includes(lowerSearch) ||
        (message.campaign_name || "").toLowerCase().includes(lowerSearch);

      return matchesStatus && matchesSearch;
    });
  }, [messages, searchTerm, statusFilter]);

  const deliveredCount = messages.filter(
    (message) => message.status === "delivered",
  ).length;
  const queuedCount = messages.filter(
    (message) => message.status === "queued",
  ).length;
  const failedCount = messages.filter(
    (message) => message.status === "failed",
  ).length;

  const summaryCards = [
    {
      label: "All Messages",
      value: messages.length,
      description: "Recent SMS activity",
      icon: MessageSquare,
      surfaceClassName: "bg-blue-50 text-blue-600",
    },
    {
      label: "Delivered",
      value: deliveredCount,
      description: "Successfully delivered",
      icon: CheckCircle2,
      surfaceClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Queued",
      value: queuedCount,
      description: "Waiting to send",
      icon: Clock,
      surfaceClassName: "bg-amber-50 text-amber-600",
    },
    {
      label: "Failed",
      value: failedCount,
      description: "Need attention",
      icon: AlertCircle,
      surfaceClassName: "bg-red-50 text-red-600",
    },
  ];

  const filters: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "delivered", label: "Delivered" },
    { value: "queued", label: "Queued" },
    { value: "failed", label: "Failed" },
    { value: "sent", label: "Sent" },
  ];

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-[30px] border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-7">
          <div className="min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              className="mb-3 h-9 rounded-xl px-3 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              onClick={() => navigate("/sms")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to SMS Campaigns
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              SMS Messages
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500 sm:text-base">
              Review recent message delivery, spot issues quickly, and jump back
              to the campaigns that generated each send.
            </p>
          </div>

          <Button
            onClick={() => navigate("/sms/new")}
            className="h-11 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <Send className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card
              key={card.label}
              className="rounded-[24px] border border-gray-100 bg-white shadow-sm"
            >
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gray-400">
                    {card.label}
                  </p>
                  <div className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                    {card.value.toLocaleString()}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {card.description}
                  </p>
                </div>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.surfaceClassName}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-[28px] border border-gray-100 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-gray-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold text-gray-900">
              Recent Message History
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Search messages, filter by delivery status, and inspect issues
              without leaving the SMS workspace.
            </CardDescription>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[360px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search phone, campaign, or message text"
                className="h-11 rounded-xl border-gray-200 pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={
                    statusFilter === filter.value ? "default" : "outline"
                  }
                  className={
                    statusFilter === filter.value
                      ? "h-9 rounded-xl bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700"
                      : "h-9 rounded-xl border-gray-200 px-4 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-[22px] bg-gray-100"
                />
              ))}
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[24px] border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">
                No messages match this view
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Try clearing the search or switching filters to see more SMS
                activity.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((message) => {
                const hasMedia = message.media_urls.length > 0;

                return (
                  <div
                    key={message.id}
                    className="rounded-[22px] border border-gray-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
                            <MessageSquare className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-gray-900">
                                  {maskPhone(message.phone)}
                                </p>
                                {getStatusBadge(message.status)}
                                {hasMedia ? (
                                  <Badge
                                    variant="outline"
                                    className="border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-50"
                                  >
                                    MMS
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-xs text-gray-400">
                                {formatDistanceToNow(
                                  new Date(message.created_at),
                                  { addSuffix: true },
                                )}
                              </p>
                            </div>

                            <p className="text-sm text-gray-600">
                              {message.content}
                            </p>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              {message.campaign_name ? (
                                <span>Campaign: {message.campaign_name}</span>
                              ) : (
                                <span>Direct or test send</span>
                              )}
                              {message.from_phone ? (
                                <span>From {message.from_phone}</span>
                              ) : null}
                              {message.delivered_at ? (
                                <span>Delivered</span>
                              ) : null}
                            </div>

                            {message.error_message ? (
                              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                                {message.error_code
                                  ? `${message.error_code}: `
                                  : ""}
                                {message.error_message}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {message.campaign_id ? (
                        <div className="lg:pl-4">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 rounded-xl px-3 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            onClick={() =>
                              navigate(`/sms/${message.campaign_id}`)
                            }
                          >
                            View Campaign
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
