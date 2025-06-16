
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
      className="group w-full bg-white border border-gray-200 rounded-lg p-4 cursor-pointer transition-all duration-300 ease-apple hover:shadow-md hover:border-gray-300 hover:scale-[1.01] active:scale-[0.99] apple-focus"
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
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors duration-200">
          <IconComponent className={`w-5 h-5 ${item.color}`} />
        </div>
        
        <div className="flex-1 min-w-0 space-y-1">
          <h4 className="text-base font-semibold text-text-primary leading-tight">
            {item.title}
          </h4>
          
          <p className="text-sm text-text-secondary leading-relaxed">
            {item.description}
          </p>
          
          <p className="text-xs text-text-tertiary leading-normal">
            {item.benefit}
          </p>
        </div>
      </div>
    </div>
  );
};
