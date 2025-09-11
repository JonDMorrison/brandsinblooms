# Stripe Setup Instructions for BloomSuite Pricing

## Overview
You've successfully updated your pricing page to show a single annual BloomSuite plan for $2,999 USD. Now you need to create the corresponding product and price in your Stripe dashboard.

## Steps to Configure Stripe

### 1. Log into your Stripe Dashboard
- Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
- Make sure you're in the correct account/environment (Test or Live)

### 2. Create the BloomSuite Product
1. Navigate to **Products** in the left sidebar
2. Click **+ Add product**
3. Fill in the product details:
   - **Name**: `BloomSuite Complete`
   - **Description**: `Complete AI-powered marketing and CRM solution for garden centers`
   - **Image**: Upload your BloomSuite logo if you have one
   - **Statement descriptor**: `BloomSuite` (this appears on customer's bank statements)

### 3. Create the Annual Price
1. In the same product creation form, add a recurring price:
   - **Price**: `2999` (in cents, so $29.99 becomes 2999)
   - **Currency**: `USD`
   - **Billing period**: `Yearly`
   - **Price description**: `Annual subscription`
2. Click **Save product**

### 4. Copy the Price ID
1. After creating the product, click on it to view details
2. In the **Pricing** section, you'll see your annual price
3. Click on the price to expand details
4. Copy the **Price ID** (it will look like `price_1AbCdEfGhIjKlMnOpQrStUvW`)

### 5. Update Your Code
1. Open the file `supabase/functions/create-checkout/index.ts`
2. Find line 142 that contains:
   ```typescript
   'bloomsuite_year': 'price_CHANGEME_BLOOMSUITE_ANNUAL',
   ```
3. Replace `'price_CHANGEME_BLOOMSUITE_ANNUAL'` with your actual Stripe Price ID:
   ```typescript
   'bloomsuite_year': 'price_1AbCdEfGhIjKlMnOpQrStUvW',
   ```

### 6. Test the Integration
1. Use Stripe's test mode first with test card numbers
2. Test card: `4242 4242 4242 4242` (Visa)
3. Use any future expiry date and any 3-digit CVC
4. Complete a test checkout to ensure everything works

### 7. Go Live
1. Switch to Live mode in Stripe
2. Create the same product and price in Live mode
3. Update your Supabase edge function with the Live mode Price ID
4. Update your Stripe secret key in Supabase to use the Live key

## Important Notes

- **Test Mode vs Live Mode**: Make sure you're using the correct Price IDs for your environment
- **Webhooks**: Your existing webhook should handle the new BloomSuite subscriptions automatically
- **Tax**: Consider enabling Stripe Tax if you need to collect sales tax
- **Invoicing**: Stripe will automatically handle invoicing for recurring subscriptions

## Verification Checklist
- [ ] BloomSuite product created in Stripe
- [ ] Annual price ($2,999) created and Price ID copied
- [ ] Price ID updated in `supabase/functions/create-checkout/index.ts`
- [ ] Test checkout completed successfully
- [ ] Live mode configured (when ready to go live)

## Support
If you encounter any issues:
1. Check the Stripe logs in your dashboard for any errors
2. Review the Supabase function logs
3. Ensure your Stripe secret key is correctly configured in Supabase

Your new pricing structure is now ready to go live!