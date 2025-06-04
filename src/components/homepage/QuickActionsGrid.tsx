
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const QuickActionsGrid = () => {
  return (
    <Card className="shadow-lg border-green-200 rounded-xl">
      <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 rounded-t-xl">
        <CardTitle className="text-xl text-black font-bold">Quick Actions</CardTitle>
        <CardDescription className="font-medium">Everything you need to grow your presence</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="group cursor-pointer">
            <Card className="h-full border-2 border-green-200 hover:border-green-400 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-green-50 to-green-100">
              <CardContent className="p-6 text-center">
                <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform duration-200">🌻</span>
                <h3 className="font-bold text-black mb-2">Create a Campaign</h3>
                <p className="text-sm text-black">Start from a template or blank canvas</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="group cursor-pointer">
            <Card className="h-full border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-6 text-center">
                <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform duration-200">📷</span>
                <h3 className="font-bold text-blue-800 mb-2">Upload Photos</h3>
                <p className="text-sm text-blue-600">Add your beautiful garden visuals</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="group cursor-pointer">
            <Card className="h-full border-2 border-yellow-200 hover:border-yellow-400 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-yellow-50 to-yellow-100">
              <CardContent className="p-6 text-center">
                <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform duration-200">🗓️</span>
                <h3 className="font-bold text-yellow-800 mb-2">Submit New Event</h3>
                <p className="text-sm text-yellow-600">Tell us what's happening at your center</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
