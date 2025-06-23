
declare module 'react-swipeable-list' {
  import { ReactNode } from 'react';

  export interface SwipeableListProps {
    children: ReactNode;
  }

  export interface SwipeableListItemProps {
    children: ReactNode;
    trailingActions?: ReactNode;
  }

  export interface TrailingActionsProps {
    children: ReactNode;
  }

  export interface SwipeActionProps {
    children: ReactNode;
    onClick: () => void;
    destructive?: boolean;
  }

  export const SwipeableList: React.FC<SwipeableListProps>;
  export const SwipeableListItem: React.FC<SwipeableListItemProps>;
  export const TrailingActions: React.FC<TrailingActionsProps>;
  export const SwipeAction: React.FC<SwipeActionProps>;
}
