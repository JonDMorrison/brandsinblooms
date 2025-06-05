
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, User, Mail, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface ActivityItem {
  id: string;
  type: 'member_invited' | 'member_joined' | 'member_removed';
  description: string;
  timestamp: string;
  user_email?: string;
}

interface TeamActivityProps {
  teamMembers: any[];
}

export const TeamActivity = ({ teamMembers }: TeamActivityProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Generate activity items from team members data
    const activityItems: ActivityItem[] = [];

    teamMembers.forEach(member => {
      // Invitation activity
      activityItems.push({
        id: `invite-${member.id}`,
        type: 'member_invited',
        description: `${member.email} was invited to join the team`,
        timestamp: member.invited_at,
        user_email: member.email
      });

      // Join activity (if joined)
      if (member.joined_at) {
        activityItems.push({
          id: `join-${member.id}`,
          type: 'member_joined',
          description: `${member.email} joined the team`,
          timestamp: member.joined_at,
          user_email: member.email
        });
      }
    });

    // Sort by timestamp (newest first)
    activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivities(activityItems.slice(0, 10)); // Show last 10 activities
  }, [teamMembers]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'member_invited':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'member_joined':
        return <User className="w-4 h-4 text-green-500" />;
      case 'member_removed':
        return <Trash2 className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'member_invited':
        return 'bg-blue-50 text-blue-700';
      case 'member_joined':
        return 'bg-green-50 text-green-700';
      case 'member_removed':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No recent activity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Activity className="w-5 h-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <div className="mt-0.5">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {activity.description}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {format(new Date(activity.timestamp), 'MMM d, yyyy at h:mm a')}
                </p>
              </div>
              <Badge variant="outline" className={getActivityColor(activity.type)}>
                {activity.type.replace('_', ' ')}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
