import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startOfMonth, format } from 'date-fns';
import { useLocalStorage } from './useLocalStorage';

interface UsePlannerMonthReturn {
  month: Date;
  setMonth: (date: Date) => void;
  monthLabel: string;
  monthStartISO: string;
}

export function usePlannerMonth(): UsePlannerMonthReturn {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [storedMonth, setStoredMonth] = useLocalStorage('planner.month', '');
  
  // Get current month as fallback
  const getCurrentMonth = () => startOfMonth(new Date());
  
  // Parse month from URL or localStorage
  const getInitialMonth = (): Date => {
    const urlMonth = searchParams.get('month');
    
    if (urlMonth && /^\d{4}-\d{2}$/.test(urlMonth)) {
      try {
        const date = new Date(`${urlMonth}-01`);
        if (!isNaN(date.getTime())) {
          return startOfMonth(date);
        }
      } catch (e) {
        console.warn('Invalid month in URL:', urlMonth);
      }
    }
    
    if (storedMonth && /^\d{4}-\d{2}$/.test(storedMonth)) {
      try {
        const date = new Date(`${storedMonth}-01`);
        if (!isNaN(date.getTime())) {
          return startOfMonth(date);
        }
      } catch (e) {
        console.warn('Invalid stored month:', storedMonth);
      }
    }
    
    return getCurrentMonth();
  };

  const [month, setMonthState] = useState<Date>(getInitialMonth);

  // Update URL when month changes (without navigation)
  const updateURL = useCallback((newMonth: Date) => {
    const monthParam = format(newMonth, 'yyyy-MM');
    const url = new URL(window.location.href);
    url.searchParams.set('month', monthParam);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Set month with URL and localStorage sync
  const setMonth = useCallback((newMonth: Date) => {
    const monthStart = startOfMonth(newMonth);
    const monthParam = format(monthStart, 'yyyy-MM');
    
    setMonthState(monthStart);
    setStoredMonth(monthParam);
    updateURL(monthStart);
  }, [setStoredMonth, updateURL]);

  // Sync with URL changes
  useEffect(() => {
    const urlMonth = searchParams.get('month');
    if (urlMonth && /^\d{4}-\d{2}$/.test(urlMonth)) {
      try {
        const date = startOfMonth(new Date(`${urlMonth}-01`));
        if (!isNaN(date.getTime()) && format(date, 'yyyy-MM') !== format(month, 'yyyy-MM')) {
          setMonthState(date);
        }
      } catch (e) {
        // Invalid URL month, ignore
      }
    }
  }, [searchParams, month]);

  const monthLabel = format(month, 'MMMM yyyy');
  const monthStartISO = month.toISOString();

  return {
    month,
    setMonth,
    monthLabel,  
    monthStartISO
  };
}