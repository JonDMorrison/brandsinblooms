
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const AnalyticsSnapshot = () => {
  return (
    <Card className="shadow-lg border-green-200 rounded-xl">
      <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 rounded-t-xl">
        <CardTitle className="text-xl text-black font-bold">Analytics Snapshot</CardTitle>
        <CardDescription className="font-medium">Coming soon - track your marketing performance</CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
            <p className="text-3xl font-bold text-gray-400 mb-2">--</p>
            <p className="text-sm text-gray-600 font-semibold">Top Performing Post</p>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
            <p className="text-3xl font-bold text-gray-400 mb-2">--</p>
            <p className="text-sm text-gray-600 font-semibold">Most Used Hashtags</p>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
            <p className="text-3xl font-bold text-gray-400 mb-2">--</p>
            <p className="text-sm text-gray-600 font-semibold">Campaign Success Rate</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
