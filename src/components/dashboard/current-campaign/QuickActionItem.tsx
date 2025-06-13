
interface QuickActionItemProps {
  item: {
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    benefit: string;
    color: string;
    bgColor: string;
    onClick: () => void;
    ariaLabel: string;
  };
}

export const QuickActionItem = ({ item }: QuickActionItemProps) => {
  const IconComponent = item.icon;

  return (
    <div
      className={`w-full border border-gray-200 rounded-lg px-4 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md hover:border-gray-300 ${item.bgColor}`}
      onClick={item.onClick}
      role="button"
      tabIndex={0}
      aria-label={item.ariaLabel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.onClick();
        }
      }}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <IconComponent className={`w-6 h-6 ${item.color}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-lg font-semibold text-black mb-1">
            {item.title}
          </h4>
          
          <p className="text-sm text-gray-600 leading-relaxed mb-1 text-wrap overflow-hidden">
            {item.description}
          </p>
          
          <p className="text-sm text-gray-500 leading-relaxed text-wrap overflow-hidden">
            {item.benefit}
          </p>
        </div>
      </div>
    </div>
  );
};
