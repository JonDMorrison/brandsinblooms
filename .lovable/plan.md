
# Plan: Send SMS to Specific Segments Feature

## Overview
Add functionality to send SMS messages directly to customer segments from multiple entry points in the application, with proper activity logging for tracking.

## User Journey

### Entry Points
Users will be able to send SMS to a segment from:
1. **/sms Dashboard** - New "Send to Segment" card/action
2. **Segment Details Modal** - "Send SMS" button in the dialog footer
3. **Custom Segment Cards** - "Send SMS" action button alongside existing buttons
4. **System Segment Cards** - "Send SMS" action on overview cards

### Flow
1. User clicks "Send SMS" on any segment
2. Opens a dedicated dialog showing:
   - Segment name and customer count
   - Message composer with character counter
   - Optional image upload for MMS
   - Phone preview of the message
   - Send button with confirmation
3. On send, system creates a campaign, triggers sending, and logs the activity
4. User sees success/error feedback

---

## Components to Create/Modify

### 1. New Component: `SegmentSMSDialog`
Location: `src/components/sms/SegmentSMSDialog.tsx`

A modal dialog for composing and sending SMS to a selected segment:
- **Inputs**: Segment ID, name, customer count
- **Features**:
  - Message textarea with 160 character indicator
  - Optional MMS image upload
  - Live character count and segment indicator
  - Recipient count display
  - Send confirmation
- **Actions**: Creates campaign, invokes `send-sms-campaign`, logs activity

### 2. Modify: SMS Dashboard
File: `src/pages/sms/SMSDashboard.tsx`

Add a new card or button: "Send to Segment"
- Opens a segment selector first, then the SMS dialog
- Provides quick access from the main SMS hub

### 3. Modify: Segment Details Modal  
File: `src/components/crm/segments/SegmentDetailsModal.tsx`

Add "Send SMS" button in the footer alongside "Close"
- Triggers the SegmentSMSDialog with current segment data

### 4. Modify: Segment Card (Custom Segments)
File: `src/components/crm/segments/SegmentCard.tsx`

Add "Send SMS" button in the action buttons section:
- Sits alongside "View Details" and "Create Campaign"
- Opens SegmentSMSDialog directly

### 5. Modify: Segment Overview Card (System Segments)
File: `src/components/crm/segments/SegmentOverviewCard.tsx`

Add "Send SMS" action:
- New prop: `onSendSMS?: () => void`
- New button in the action area

### 6. Modify: CRM Segments Page
File: `src/pages/crm/CRMSegmentsPage.tsx`

Add state management for SMS dialog:
- Track which segment is selected for SMS sending
- Handle the dialog open/close

---

## Activity Logging

### Activity Event Structure
When SMS is sent to a segment, log to `crm_activity_events`:

```javascript
{
  tenant_id: string,
  customer_id: null, // Bulk send, no single customer
  actor_type: 'user',
  actor_id: user.id,
  source: 'ui',
  activity_type: 'sms_segment_send',
  status: 'success' | 'failed',
  title: 'SMS sent to segment',
  description: {
    parts: [
      { type: 'text', text: 'Sent SMS to ' },
      { type: 'mention', label: 'Segment Name' },
      { type: 'text', text: ' targeting X recipients' }
    ]
  },
  metadata: {
    segment_id: string,
    segment_name: string,
    recipient_count: number,
    message_preview: string (first 50 chars),
    campaign_id: string,
    has_media: boolean
  },
  related_entities: {
    segment_id: string,
    campaign_id: string
  },
  links: [
    { type: 'segment', href: '/crm/segments?highlight=ID', label: 'View Segment' },
    { type: 'campaign', href: '/sms/CAMPAIGN_ID', label: 'View Campaign' }
  ]
}
```

### Where to Log
- In the `SegmentSMSDialog` after successful campaign creation and send initiation
- Use the existing `logActivity` function from `src/lib/activityLogger.ts`

---

## Technical Details

### SegmentSMSDialog Component Structure

```text
+----------------------------------+
|  Send SMS to [Segment Name]      |
+----------------------------------+
|  [X] 234 SMS-enabled customers   |
+----------------------------------+
|  Message:                        |
|  +----------------------------+  |
|  | Your message here...      |  |
|  |                           |  |
|  +----------------------------+  |
|  142/160 characters (1 segment)  |
+----------------------------------+
|  Image (Optional):               |
|  [Upload Image] or drag & drop   |
+----------------------------------+
|  [Cancel]        [Send SMS]      |
+----------------------------------+
```

### Data Flow

```text
User clicks "Send SMS"
        |
        v
SegmentSMSDialog opens
        |
        v
User composes message
        |
        v
User clicks "Send"
        |
        v
Create crm_sms_campaigns record
        |
        v
Link to segment via campaign_segments
        |
        v
Invoke send-sms-campaign edge function
        |
        v
Log activity to crm_activity_events
        |
        v
Show success/error toast
        |
        v
Close dialog
```

### Edge Cases to Handle
1. **No SMS-enabled customers**: Show warning before send
2. **Empty message**: Disable send button
3. **Message too long**: Show segment count indicator
4. **Send failure**: Log failure event, show error
5. **Already sending**: Prevent duplicate sends

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/sms/SegmentSMSDialog.tsx` | Create | New dialog for segment SMS |
| `src/pages/sms/SMSDashboard.tsx` | Modify | Add "Send to Segment" entry point |
| `src/components/crm/segments/SegmentDetailsModal.tsx` | Modify | Add "Send SMS" button |
| `src/components/crm/segments/SegmentCard.tsx` | Modify | Add "Send SMS" action |
| `src/components/crm/segments/SegmentOverviewCard.tsx` | Modify | Add `onSendSMS` prop and button |
| `src/pages/crm/CRMSegmentsPage.tsx` | Modify | Add SMS dialog state management |
