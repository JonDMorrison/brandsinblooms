# BloomSuite Form Builder — Phase 2 QA Checklist

**Focus:** Usability & Support Readiness  
**Scope:** End-user experience, self-service embedding, support workflows  
**Explicitly Excluded:** Consent logic, rate limiting, security testing (covered in Phase 1)

---

## Test Environment

- [ ] Testing on production-like environment
- [ ] Tester has no developer/admin background
- [ ] Fresh browser session (no cached data)
- [ ] Timer available for support workflow tests

---

## 1. End-to-End Form Creation (Non-Technical User)

**Goal:** A user with no technical background can create a complete, working form.

### 1.1 Starting a New Form
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 1.1.1 | User can find "Create Form" button within 10 seconds | | | |
| 1.1.2 | Form name input is clearly labeled | | | |
| 1.1.3 | Template selection is visually clear with descriptions | | | |
| 1.1.4 | Selecting a template pre-populates fields correctly | | | |

### 1.2 Adding & Editing Fields
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 1.2.1 | "Add Field" button is visible without scrolling | | | |
| 1.2.2 | Field type icons/labels are self-explanatory | | | |
| 1.2.3 | User can rename a field label by clicking on it | | | |
| 1.2.4 | Required toggle is clearly visible per field | | | |
| 1.2.5 | Drag-and-drop reordering works on first attempt | | | |
| 1.2.6 | User can delete a field without confusion | | | |
| 1.2.7 | Placeholder text editing is intuitive | | | |

### 1.3 Styling the Form
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 1.3.1 | Color picker is easy to use | | | |
| 1.3.2 | Button style options are visually previewed | | | |
| 1.3.3 | Font selection shows example text | | | |
| 1.3.4 | Changes appear in preview immediately | | | |

### 1.4 Publishing
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 1.4.1 | Publish button is clearly visible | | | |
| 1.4.2 | User understands form is "live" after publishing | | | |
| 1.4.3 | Embed code is displayed after publishing | | | |
| 1.4.4 | User can copy embed code with one click | | | |

### 1.5 Overall Flow
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 1.5.1 | User completes form creation in under 5 minutes | | | |
| 1.5.2 | No error messages encountered during normal flow | | | |
| 1.5.3 | User did not need to ask for help | | | |

---

## 2. Self-Service Embedding (No Developer Required)

**Goal:** User can embed the form on a website without technical assistance.

### 2.1 Embed Code Clarity
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 2.1.1 | Embed code is syntax-highlighted or formatted | | | |
| 2.1.2 | Copy button provides feedback (e.g., "Copied!") | | | |
| 2.1.3 | Instructions mention where to paste the code | | | |
| 2.1.4 | Platform-specific instructions are available (WP, Squarespace, Shopify) | | | |

### 2.2 WordPress Embedding
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 2.2.1 | User can embed via Custom HTML block | | | |
| 2.2.2 | Form displays correctly in WordPress preview | | | |
| 2.2.3 | Form submits successfully on live WordPress page | | | |

### 2.3 Squarespace Embedding
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 2.3.1 | User can embed via Code Block | | | |
| 2.3.2 | Form displays correctly in Squarespace preview | | | |
| 2.3.3 | Form submits successfully on live Squarespace page | | | |

### 2.4 Shopify Embedding
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 2.4.1 | User can embed via Custom Liquid section | | | |
| 2.4.2 | Form displays correctly in Shopify preview | | | |
| 2.4.3 | Form submits successfully on live Shopify page | | | |

### 2.5 Generic HTML
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 2.5.1 | Form works when pasted into plain HTML file | | | |
| 2.5.2 | Form loads without console errors | | | |

---

## 3. Support Workflow: Failed Submission Diagnosis

**Goal:** Support agent can explain why a submission failed within 60 seconds.

### 3.1 Finding the Submission
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 3.1.1 | Submissions tab is easy to locate | | | |
| 3.1.2 | Email search finds submission in under 5 seconds | | | |
| 3.1.3 | Date range filter narrows results effectively | | | |
| 3.1.4 | Status filter (Accepted/Rejected) works correctly | | | |

### 3.2 Understanding the Failure
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 3.2.1 | Rejection reason column is visible in table | | | |
| 3.2.2 | Rejection reason uses plain language (not error codes) | | | |
| 3.2.3 | Clicking row shows full submission details | | | |
| 3.2.4 | Detail modal shows what the user submitted | | | |
| 3.2.5 | Timestamp is clearly displayed | | | |

### 3.3 Timed Test (60-Second Challenge)
| # | Scenario | Time | Pass (<60s) | Notes |
|---|----------|------|-------------|-------|
| 3.3.1 | Find submission by email, explain rejection | | | |
| 3.3.2 | Find today's rejected submissions, identify pattern | | | |
| 3.3.3 | Locate specific submission from 7 days ago | | | |

---

## 4. Submission Export

**Goal:** User can export submission data without technical help.

### 4.1 Export Functionality
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 4.1.1 | Export button is visible on Submissions tab | | | |
| 4.1.2 | Export respects current filters | | | |
| 4.1.3 | CSV download starts within 3 seconds | | | |
| 4.1.4 | Downloaded file opens correctly in Excel/Sheets | | | |
| 4.1.5 | All expected columns are present in export | | | |
| 4.1.6 | Email addresses are not truncated | | | |
| 4.1.7 | Timestamps are human-readable | | | |

### 4.2 Export Edge Cases
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 4.2.1 | Empty result set shows appropriate message | | | |
| 4.2.2 | Large export (500+ rows) completes successfully | | | |
| 4.2.3 | Special characters in submissions export correctly | | | |

---

## 5. Styling Preview vs Live Embed Parity

**Goal:** What users see in the preview matches exactly what appears on their website.

### 5.1 Visual Comparison
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 5.1.1 | Primary color matches between preview and live | | | |
| 5.1.2 | Button style matches between preview and live | | | |
| 5.1.3 | Border radius matches between preview and live | | | |
| 5.1.4 | Font family matches between preview and live | | | |
| 5.1.5 | Spacing/padding matches between preview and live | | | |
| 5.1.6 | Field order matches between preview and live | | | |

### 5.2 Interactive Behavior
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 5.2.1 | Required field validation looks the same | | | |
| 5.2.2 | Error message styling matches | | | |
| 5.2.3 | Success message matches configured text | | | |
| 5.2.4 | Submit button text matches configured text | | | |

### 5.3 Responsive Behavior
| # | Test Case | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 5.3.1 | Mobile preview matches mobile embed | | | |
| 5.3.2 | Form adapts to container width correctly | | | |

---

## Summary Scorecard

| Section | Total Tests | Passed | Failed | Pass Rate |
|---------|-------------|--------|--------|-----------|
| 1. Form Creation | 17 | | | |
| 2. Self-Service Embedding | 14 | | | |
| 3. Support Workflow | 11 | | | |
| 4. Submission Export | 10 | | | |
| 5. Preview/Live Parity | 11 | | | |
| **TOTAL** | **63** | | | |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Product Owner | | | |
| Support Lead | | | |

---

## Notes & Issues Found

*(Document any issues, confusion points, or improvement suggestions here)*

1. 
2. 
3. 

---

*Checklist Version: 1.0*  
*Created: January 2026*  
*Phase 1 Reference: Security & compliance testing (separate document)*
