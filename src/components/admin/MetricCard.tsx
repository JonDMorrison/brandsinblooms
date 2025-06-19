
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: number;
  description: string;
  icon: LucideIcon;
  color: string;
  borderColor: string;
  bgColor: string;
  clickable?: boolean;
  href?: string;
  suffix?: string;
  prefix?: string;
}

export const MetricCard = ({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  color, 
  borderColor, 
  bgColor, 
  clickable = false,
  href,
  suffix = "",
  prefix = ""
}: MetricCardProps) => {
  const handleClick = () => {
    if (clickable && href) {
      console.log(`Navigate to: ${href}`);
    }
  };

  return (
    <Card 
      className={`${borderColor} ${bgColor} rounded-xl transition-all duration-200 ${
        clickable ? 'cursor-pointer hover:shadow-md hover:scale-105' : ''
      }`}
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className="h-5 w-5 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>
          {value === 0 && !clickable ? '—' : `${prefix}${value}${suffix}`}
        </div>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
};
