import '@testing-library/jest-dom/vitest';
import {it,expect,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {ImportedCustomerSummary} from './ImportedCustomerSummary';
afterEach(cleanup);
it('keeps the source code and explains reported period totals',()=>{render(<ImportedCustomerSummary fields={{ideal_customer_code:'00123',ideal_import_source:'synthetic.txt',ideal_reported_ytd:{start:'2026-01-01',end:'2026-10-14',spend:125.5,transactions:2}}}/>);expect(screen.getByText('Customer code 00123')).toBeVisible();expect(screen.getByText(/\$125.50 reported spending/)).toBeVisible();expect(screen.getByText(/not lifetime value/)).toBeVisible();});
it('does not show Ideal-specific content on other customers',()=>{const {container}=render(<ImportedCustomerSummary fields={{}}/>);expect(container).toBeEmptyDOMElement();});
