import { supabase } from '@/integrations/supabase/client';

export interface CouponConfig {
  prefix?: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
  discount_value: number;
  min_purchase_amount?: number;
  expires_at?: Date;
  usage_limit?: number;
  campaign_id?: string;
  automation_id?: string;
}

export class CouponManager {
  private static generateCode(prefix: string = 'SAVE', length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = prefix;
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static async generateCoupons(
    count: number,
    config: CouponConfig
  ): Promise<string[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!userRecord?.tenant_id) throw new Error('No tenant found');

      // Get company info for prefix
      const { data: companyProfile } = await supabase
        .from('company_profiles')
        .select('company_name')
        .eq('user_id', user.id)
        .single();

      const prefix = config.prefix || 
        (companyProfile?.company_name?.substring(0, 4).toUpperCase()) || 'SAVE';

      const coupons = [];
      const batchSize = 100; // Insert in batches to avoid timeouts

      for (let i = 0; i < count; i += batchSize) {
        const batch = [];
        const batchCount = Math.min(batchSize, count - i);

        for (let j = 0; j < batchCount; j++) {
          let code: string;
          let isUnique = false;
          let attempts = 0;

          // Ensure code uniqueness
          while (!isUnique && attempts < 10) {
            code = this.generateCode(prefix);
            const { data: existing } = await supabase
              .from('coupons')
              .select('id')
              .eq('code', code)
              .single();

            if (!existing) {
              isUnique = true;
              batch.push({
                code,
                tenant_id: userRecord.tenant_id,
                campaign_id: config.campaign_id,
                automation_id: config.automation_id,
                discount_type: config.discount_type,
                discount_value: config.discount_value,
                min_purchase_amount: config.min_purchase_amount,
                expires_at: config.expires_at?.toISOString(),
                usage_limit: config.usage_limit || 1
              });
            }
            attempts++;
          }

          if (!isUnique) {
            throw new Error('Unable to generate unique coupon code');
          }
        }

        const { data, error } = await supabase
          .from('coupons')
          .insert(batch)
          .select('code');

        if (error) throw error;
        coupons.push(...(data?.map(c => c.code) || []));
      }

      return coupons;
    } catch (error) {
      console.error('Failed to generate coupons:', error);
      throw error;
    }
  }

  static async redeemCoupon(
    couponCode: string,
    posTxnId: string,
    netSales: number
  ): Promise<boolean> {
    try {
      // Check if coupon exists and is valid
      const { data: coupon, error: fetchError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .single();

      if (fetchError || !coupon) {
        throw new Error('Coupon not found');
      }

      if (!coupon.is_active) {
        throw new Error('Coupon is not active');
      }

      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        throw new Error('Coupon has expired');
      }

      if (coupon.usage_count >= coupon.usage_limit) {
        throw new Error('Coupon usage limit exceeded');
      }

      if (coupon.min_purchase_amount && netSales < coupon.min_purchase_amount) {
        throw new Error('Minimum purchase amount not met');
      }

      // Redeem the coupon
      const { error: updateError } = await supabase
        .from('coupons')
        .update({
          usage_count: coupon.usage_count + 1,
          redeemed_at: new Date().toISOString(),
          pos_txn_id: posTxnId,
          net_sales: netSales,
          is_active: coupon.usage_count + 1 >= coupon.usage_limit ? false : coupon.is_active
        })
        .eq('id', coupon.id);

      if (updateError) throw updateError;

      return true;
    } catch (error) {
      console.error('Failed to redeem coupon:', error);
      throw error;
    }
  }

  static async getCouponStats(campaignId?: string, days: number = 30) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = supabase
        .from('coupons')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      const { data: coupons, error } = await query;

      if (error) throw error;

      const stats = {
        total_generated: coupons?.length || 0,
        total_redeemed: coupons?.filter(c => c.redeemed_at).length || 0,
        total_revenue: coupons?.reduce((sum, c) => sum + (c.net_sales || 0), 0) || 0,
        redemption_rate: 0,
        avg_order_value: 0,
        active_coupons: coupons?.filter(c => c.is_active).length || 0
      };

      stats.redemption_rate = stats.total_generated > 0 
        ? (stats.total_redeemed / stats.total_generated) * 100 
        : 0;

      stats.avg_order_value = stats.total_redeemed > 0 
        ? stats.total_revenue / stats.total_redeemed 
        : 0;

      return stats;
    } catch (error) {
      console.error('Failed to get coupon stats:', error);
      return null;
    }
  }

  static async validateCoupon(couponCode: string): Promise<{
    valid: boolean;
    coupon?: any;
    error?: string;
  }> {
    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .single();

      if (error || !coupon) {
        return { valid: false, error: 'Coupon not found' };
      }

      if (!coupon.is_active) {
        return { valid: false, error: 'Coupon is not active' };
      }

      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return { valid: false, error: 'Coupon has expired' };
      }

      if (coupon.usage_count >= coupon.usage_limit) {
        return { valid: false, error: 'Coupon usage limit exceeded' };
      }

      return { valid: true, coupon };
    } catch (error) {
      console.error('Failed to validate coupon:', error);
      return { valid: false, error: 'Validation failed' };
    }
  }
}