import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { PlanWizardState, PlanItem, PlanTheme } from './constants';

type PlanAction = 
  | { type: 'SET_MONTH'; payload: string }
  | { type: 'SET_THEME'; payload: PlanTheme }
  | { type: 'SET_ITEMS'; payload: PlanItem[] }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<PlanItem> } }
  | { type: 'TOGGLE_ITEM'; payload: string }
  | { type: 'RESET' };

interface PlanWizardContextType {
  state: PlanWizardState;
  dispatch: React.Dispatch<PlanAction>;
  setMonth: (month: string) => void;
  setTheme: (theme: PlanTheme) => void;
  setItems: (items: PlanItem[]) => void;
  updateItem: (id: string, updates: Partial<PlanItem>) => void;
  toggleItem: (id: string) => void;
  reset: () => void;
}

const PlanWizardContext = createContext<PlanWizardContextType | undefined>(undefined);

const initialState: PlanWizardState = {
  month: '',
  theme: null,
  items: []
};

function planWizardReducer(state: PlanWizardState, action: PlanAction): PlanWizardState {
  switch (action.type) {
    case 'SET_MONTH':
      return { ...state, month: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_ITEMS':
      return { ...state, items: action.payload };
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, ...action.payload.updates }
            : item
        )
      };
    case 'TOGGLE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload
            ? { ...item, enabled: !item.enabled }
            : item
        )
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface PlanWizardProviderProps {
  children: ReactNode;
}

export const PlanWizardProvider: React.FC<PlanWizardProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(planWizardReducer, initialState);

  const setMonth = (month: string) => {
    dispatch({ type: 'SET_MONTH', payload: month });
  };

  const setTheme = (theme: PlanTheme) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  };

  const setItems = (items: PlanItem[]) => {
    dispatch({ type: 'SET_ITEMS', payload: items });
  };

  const updateItem = (id: string, updates: Partial<PlanItem>) => {
    dispatch({ type: 'UPDATE_ITEM', payload: { id, updates } });
  };

  const toggleItem = (id: string) => {
    dispatch({ type: 'TOGGLE_ITEM', payload: id });
  };

  const reset = () => {
    dispatch({ type: 'RESET' });
  };

  const contextValue: PlanWizardContextType = {
    state,
    dispatch,
    setMonth,
    setTheme,
    setItems,
    updateItem,
    toggleItem,
    reset
  };

  return (
    <PlanWizardContext.Provider value={contextValue}>
      {children}
    </PlanWizardContext.Provider>
  );
};

export const usePlanWizard = () => {
  const context = useContext(PlanWizardContext);
  if (context === undefined) {
    throw new Error('usePlanWizard must be used within a PlanWizardProvider');
  }
  return context;
};