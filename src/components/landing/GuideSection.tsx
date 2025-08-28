import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Users, Award, Target } from "lucide-react";

export const GuideSection = () => {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold mb-6 text-gray-900">
              We Understand Garden Centers
            </h2>
            <p className="text-xl text-[#6B7280] mb-8 leading-relaxed">
              BloomSuite was created by marketing experts who specialize in garden centers and nurseries. We've helped hundreds of plant retailers grow their business with marketing that actually works.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-[#47B881]" />
                <span className="text-lg text-gray-700">Built specifically for seasonal plant businesses</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-[#47B881]" />
                <span className="text-lg text-gray-700">Understands your customers' buying cycles</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-[#47B881]" />
                <span className="text-lg text-gray-700">Includes plant care expertise in content</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-[#47B881]" />
                <span className="text-lg text-gray-700">Proven to increase garden center sales by 40%+</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <Card className="p-6 rounded-2xl bg-[#E9F5EC] border-2 border-[#47B881]/20">
              <CardContent className="p-0">
                <Users className="w-8 h-8 text-[#47B881] mb-3" />
                <div className="text-lg font-semibold text-gray-900 mb-2">CRM & Customer Management</div>
                <div className="text-sm text-[#6B7280]">Track customers, manage campaigns, and automate follow-ups</div>
              </CardContent>
            </Card>
            
            <Card className="p-6 rounded-2xl bg-[#FEF3C7] border-2 border-[#F4C430]/20">
              <CardContent className="p-0">
                <Award className="w-8 h-8 text-[#D97706] mb-3" />
                <div className="text-lg font-semibold text-gray-900 mb-2">Social Media Automation</div>
                <div className="text-sm text-[#6B7280]">Generate and schedule plant care content across all platforms</div>
              </CardContent>
            </Card>
            
            <Card className="p-6 rounded-2xl bg-[#FDF2F2] border-2 border-[#F28C8C]/20">
              <CardContent className="p-0">
                <Target className="w-8 h-8 text-[#DC2626] mb-3" />
                <div className="text-lg font-semibold text-gray-900 mb-2">SMS & Email Campaigns</div>
                <div className="text-sm text-[#6B7280]">Send targeted promotions with seasonal plant recommendations</div>
              </CardContent>
            </Card>
            
            <Card className="p-6 rounded-2xl bg-[#E0F2FE] border-2 border-[#0EA5E9]/20">
              <CardContent className="p-0">
                <CheckCircle className="w-8 h-8 text-[#0EA5E9] mb-3" />
                <div className="text-lg font-semibold text-gray-900 mb-2">Analytics & ROI Tracking</div>
                <div className="text-sm text-[#6B7280]">Measure campaign performance and customer lifetime value</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};