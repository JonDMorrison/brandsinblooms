# BloomSuite Form Builder — User Guide

Welcome! This guide helps you embed your BloomSuite forms on any website and understand how we handle your visitors' information.

---

## Table of Contents

1. [How to Embed Your Form](#how-to-embed-your-form)
   - [Generic HTML (Any Website)](#generic-html-any-website)
   - [WordPress](#wordpress)
   - [Squarespace](#squarespace)
   - [Shopify](#shopify)
2. [Understanding Consent](#understanding-consent)
   - [Why We Ask for Email Consent](#why-we-ask-for-email-consent)
   - [Why SMS Consent is Separate](#why-sms-consent-is-separate)
   - [What We Store](#what-we-store)
3. [Troubleshooting](#troubleshooting)
   - [Form Not Showing](#form-not-showing)
   - [Security Blocking Issues](#security-blocking-issues)
   - [Ad Blockers](#ad-blockers)
   - [Too Many Submissions Error](#too-many-submissions-error)

---

## How to Embed Your Form

After creating your form in BloomSuite, you'll receive an **embed code**. Here's how to add it to different platforms.

### Finding Your Embed Code

1. Open your form in BloomSuite
2. Click **Publish** in the top right
3. Copy the embed code provided

Your embed code looks something like this:

```html
<div id="bloomsuite-form" data-form-key="your-unique-form-key"></div>
<script src="https://forms.bloomsuite.com/embed.js" async></script>
```

---

### Generic HTML (Any Website)

Works on any website where you can add custom HTML.

**Steps:**

1. Copy your embed code from BloomSuite
2. Paste it where you want the form to appear in your HTML
3. Save and publish your page

**Example:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Contact Us</title>
</head>
<body>
  <h1>Sign Up for Our Newsletter</h1>
  
  <!-- Paste your BloomSuite form here -->
  <div id="bloomsuite-form" data-form-key="abc123xyz"></div>
  <script src="https://forms.bloomsuite.com/embed.js" async></script>
  
</body>
</html>
```

**Tips:**
- Place the code exactly where you want the form to appear
- The form will automatically match your page width
- You can add multiple forms on the same page (use different containers)

---

### WordPress

**Option 1: Using the Block Editor (Gutenberg)**

1. Edit your page or post
2. Click the **+** button to add a new block
3. Search for **Custom HTML** and select it
4. Paste your BloomSuite embed code
5. Click **Update** or **Publish**

**Option 2: Using the Classic Editor**

1. Edit your page or post
2. Switch to the **Text** tab (not Visual)
3. Paste your embed code where you want the form
4. Click **Update** or **Publish**

**Option 3: Using a Widget (Sidebar/Footer)**

1. Go to **Appearance → Widgets**
2. Add a **Custom HTML** widget to your desired area
3. Paste your embed code
4. Click **Save**

---

### Squarespace

1. Edit your page in Squarespace
2. Click **+** to add a new block
3. Select **Code** from the menu
4. Paste your BloomSuite embed code
5. Click **Apply**
6. Save your page

**Important:** Make sure you're using a **Code Block**, not a Markdown block.

**If the form doesn't appear:**
- Check that JavaScript is not disabled in your Squarespace settings
- Try placing the form in a different section of your page

---

### Shopify

**Adding to a Page:**

1. Go to **Online Store → Pages**
2. Select or create the page for your form
3. Click **Show HTML** (the `<>` button in the editor)
4. Paste your embed code
5. Click **Save**

**Adding to a Theme Section:**

1. Go to **Online Store → Themes**
2. Click **Customize** on your active theme
3. Add a **Custom Liquid** or **Custom HTML** section
4. Paste your embed code
5. Click **Save**

**Adding to a Product Page:**

1. Go to **Products** and select a product
2. In the description, click **Show HTML**
3. Paste your embed code
4. Click **Save**

---

## Understanding Consent

We take your visitors' privacy seriously. Here's why we ask for consent and what it means.

### Why We Ask for Email Consent

**What it is:** Before sending marketing emails, we ask visitors to confirm they want to hear from you.

**Why it matters:**
- It's required by law in many places (like Canada's CASL and Europe's GDPR)
- It builds trust with your audience
- It leads to better engagement because people who opt in actually want your emails
- It protects you from spam complaints that could hurt your email deliverability

**What visitors see:**
> ☐ I'd like to receive emails about news, offers, and updates.

**Note:** You can customize this text in your form settings.

---

### Why SMS Consent is Separate

**What it is:** If you want to send text messages, visitors must specifically agree to receive SMS — even if they already agreed to emails.

**Why it's separate:**
- Text messages are more personal and immediate than email
- Phone regulations are stricter than email regulations (especially in the US under TCPA law)
- Message and data rates may apply to your visitors
- People have different comfort levels with texts vs. emails

**What visitors see:**
> ☐ I agree to receive text messages. Message and data rates may apply.

**Best practice:** Only enable SMS consent if you actually plan to send text messages.

---

### What We Store

When someone submits your form, here's exactly what we keep:

| What We Store | Why |
|---------------|-----|
| **Their answers** | The information they typed into your form (name, email, etc.) |
| **When they submitted** | The date and time of their submission |
| **Their consent choices** | Whether they agreed to emails and/or texts |
| **The consent text shown** | Proof of what they agreed to (for your records) |
| **Page URL** | Which page they were on when they signed up |
| **Referrer** | How they found your page (like from a Google search) |

**What we DON'T store:**
- ❌ Full IP addresses (we only keep a one-way hash for rate limiting)
- ❌ Device fingerprints
- ❌ Cookies that track across sites
- ❌ Any data you don't ask for in your form

**Plain English:** We store what your visitors tell you, plus basic info about when and where they signed up. We don't track them across the internet.

---

## Troubleshooting

### Form Not Showing

**Check these first:**

1. **Is the embed code correct?**
   - Make sure you copied the entire code (both the `<div>` and `<script>` parts)
   - Check for any typos in the form key

2. **Is the form published?**
   - Go to your form in BloomSuite
   - Make sure the status is "Published" (not "Draft")

3. **Is the page saved?**
   - After adding the embed code, make sure you saved/published your page

4. **Check your browser console:**
   - Right-click anywhere on your page
   - Select "Inspect" or "Inspect Element"
   - Click the "Console" tab
   - Look for any red error messages

**Still not working?** Try these:

- Clear your browser cache and refresh
- Try a different browser
- Check if the form works in an incognito/private window

---

### Security Blocking Issues

Sometimes your website's security settings can block the form from loading.

**Symptoms:**
- Form container appears but stays empty
- Console shows "Refused to load" or "blocked by CSP" errors

**Solutions:**

**If you manage your own website:**

Add these domains to your Content Security Policy (CSP):
```
script-src: forms.bloomsuite.com
frame-src: forms.bloomsuite.com
connect-src: *.supabase.co
```

**If you're on a hosted platform:**

- **Squarespace:** These usually work by default. Contact Squarespace support if blocked.
- **WordPress:** Check if a security plugin (like Wordfence) is blocking external scripts.
- **Shopify:** Should work by default. Check your theme's CSP settings if not.

**Contact your web host** if you see CORS errors — they may need to whitelist our domains.

---

### Ad Blockers

Some ad blockers mistake form embeds for tracking scripts.

**Symptoms:**
- Form works for you but not for some visitors
- Form appears in incognito mode but not in regular browsing

**What visitors can do:**
- Temporarily disable their ad blocker for your site
- Add your site to their ad blocker's "allowlist"

**What you can do:**
- Let visitors know that ad blockers might interfere
- Consider adding a note near your form: "Having trouble? Try disabling your ad blocker."

**Good news:** Most popular ad blockers (uBlock Origin, AdBlock Plus) don't block BloomSuite forms by default.

---

### Too Many Submissions Error

To prevent spam, we limit how quickly forms can be submitted.

**What visitors see:**
> "Please wait a moment before submitting again."

**Why this happens:**
- Someone submitted the form multiple times in quick succession
- A bot tried to spam your form
- Multiple people on the same network submitted around the same time

**This is normal and protects you.** Real visitors just need to wait a few seconds and try again.

**If legitimate submissions are being blocked:**
- Check your form's rate limit settings in BloomSuite
- Contact support if you need higher limits for high-traffic events

---

## Need More Help?

- **Email:** support@bloomsuite.com
- **Help Center:** help.bloomsuite.com
- **Live Chat:** Available in your BloomSuite dashboard

---

*Last updated: January 2026*
