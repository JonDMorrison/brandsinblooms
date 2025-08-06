import { useState, useEffect } from 'react';
import { AnalyticsTracker } from '@/lib/analytics/AnalyticsTracker';
import { CouponManager } from '@/lib/analytics/CouponManager';

export const useROIAnalytics = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchCampaignMetrics = async (campaignId: string, days: number = 30) => {
    setLoading(true);
    try {
      const [campaignMetrics, couponStats] = await Promise.all([
        AnalyticsTracker.getCampaignMetrics(campaignId, days),
        CouponManager.getCouponStats(campaignId, days)
      ]);

      setMetrics({
        ...campaignMetrics,
        ...couponStats,
        roi_percentage: campaignMetrics?.total_revenue > 0 && campaignMetrics?.total_sent > 0
          ? ((campaignMetrics.total_revenue - (campaignMetrics.total_sent * 0.02)) / (campaignMetrics.total_sent * 0.02)) * 100
          : 0
      });
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const trackLinkClick = async (url: string, campaignId?: string, contactId?: string, smsId?: string) => {
    await AnalyticsTracker.trackLinkClick(url, campaignId, contactId, smsId);
  };

  const trackCouponRedeem = async (
    couponCode: string,
    posTxnId: string,
    netSales: number,
    campaignId?: string,
    contactId?: string
  ) => {
    await AnalyticsTracker.trackCouponRedeem(couponCode, posTxnId, netSales, campaignId, contactId);
  };

  const generateCoupons = async (count: number, config: any) => {
    try {
      return await CouponManager.generateCoupons(count, config);
    } catch (error) {
      console.error('Failed to generate coupons:', error);
      throw error;
    }
  };

  const validateCoupon = async (couponCode: string) => {
    try {
      return await CouponManager.validateCoupon(couponCode);
    } catch (error) {
      console.error('Failed to validate coupon:', error);
      return { valid: false, error: 'Validation failed' };
    }
  };

  return {
    metrics,
    loading,
    fetchCampaignMetrics,
    trackLinkClick,
    trackCouponRedeem,
    generateCoupons,
    validateCoupon
  };
};