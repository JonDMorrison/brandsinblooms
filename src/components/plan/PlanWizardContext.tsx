import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { PlanWizardState, PlanItem, PlanTheme } from './constants';

type PlanAction = 
  | { type: 'SET_MONTH'; payload: string }
  | { type: 'SET_THEMES'; payload: PlanTheme[] }
  | { type: 'ADD_THEME'; payload: PlanTheme }
  | { type: 'REMOVE_THEME'; payload: string }
  | { type: 'SET_ITEMS'; payload: PlanItem[] }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<PlanItem> } }
  | { type: 'TOGGLE_ITEM'; payload: string }
  | { type: 'REPLACE_WEEK_CONTENT'; payload: { week: number; themeId: string; newItems: PlanItem[] } }
  | { type: 'ADD_WEEK_CONTENT'; payload: { week: number; newItems: PlanItem[] } }
  | { type: 'RESET' };

interface PlanWizardContextType {
  state: PlanWizardState;
  dispatch: React.Dispatch<PlanAction>;
  setMonth: (month: string) => void;
  setThemes: (themes: PlanTheme[]) => void;
  addTheme: (theme: PlanTheme) => void;
  removeTheme: (themeId: string) => void;
  setItems: (items: PlanItem[]) => void;
  updateItem: (id: string, updates: Partial<PlanItem>) => void;
  toggleItem: (id: string) => void;
  replaceWeekContent: (week: number, themeId: string, newItems: PlanItem[]) => void;
  addWeekContent: (week: number, newItems: PlanItem[]) => void;
  reset: () => void;
}

const PlanWizardContext = createContext<PlanWizardContextType | undefined>(undefined);

const initialState: PlanWizardState = {
  month: '',
  themes: [],
  items: []
};

function planWizardReducer(state: PlanWizardState, action: PlanAction): PlanWizardState {
  switch (action.type) {
    case 'SET_MONTH':
      return { ...state, month: action.payload };
    case 'SET_THEMES':
      return { ...state, themes: action.payload };
    case 'ADD_THEME':
      return { 
        ...state, 
        themes: state.themes.some(t => t.id === action.payload.id) 
          ? state.themes 
          : [...state.themes, action.payload] 
      };
    case 'REMOVE_THEME':
      return { 
        ...state, 
        themes: state.themes.filter(t => t.id !== action.payload),
        items: state.items.filter(item => item.themeId !== action.payload)
      };
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
    case 'REPLACE_WEEK_CONTENT':
      return {
        ...state,
        items: [
          ...state.items.filter(item => !(item.week === action.payload.week && item.themeId === action.payload.themeId)),
          ...action.payload.newItems
        ]
      };
    case 'ADD_WEEK_CONTENT':
      return {
        ...state,
        items: [...state.items, ...action.payload.newItems]
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

  const setThemes = (themes: PlanTheme[]) => {
    dispatch({ type: 'SET_THEMES', payload: themes });
  };

  const addTheme = (theme: PlanTheme) => {
    dispatch({ type: 'ADD_THEME', payload: theme });
  };

  const removeTheme = (themeId: string) => {
    dispatch({ type: 'REMOVE_THEME', payload: themeId });
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

  const replaceWeekContent = (week: number, themeId: string, newItems: PlanItem[]) => {
    dispatch({ type: 'REPLACE_WEEK_CONTENT', payload: { week, themeId, newItems } });
  };

  const addWeekContent = (week: number, newItems: PlanItem[]) => {
    dispatch({ type: 'ADD_WEEK_CONTENT', payload: { week, newItems } });
  };

  const reset = () => {
    dispatch({ type: 'RESET' });
  };

  const contextValue: PlanWizardContextType = {
    state,
    dispatch,
    setMonth,
    setThemes,
    addTheme,
    removeTheme,
    setItems,
    updateItem,
    toggleItem,
    replaceWeekContent,
    addWeekContent,
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