// Constants shared by server and client.

export const INQUIRY_STATUSES = ['New', 'Confirmed', 'Completed', 'Lost'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_SOURCES = ['Instagram', 'WhatsApp', 'Phone Call', 'Website', 'Referral', 'Venue', 'Other'] as const;

export const EVENT_TYPES = [
  'Wedding',
  'Sangeet',
  'Mehendi',
  'Birthday',
  'Corporate',
  'College Event',
  'Festival',
  'Private Party',
  'Other',
] as const;

export const PACKAGE_CODES = ['MINI', 'PLUS', 'PREMIUM', 'Not Sure', 'Custom'] as const;

export const BOOKING_STATUSES = ['Confirmed', 'Upcoming', 'In Progress', 'Completed', 'Cancelled'] as const;
export const PAYMENT_STATUSES = ['Unpaid', 'Advance Paid', 'Partially Paid', 'Fully Paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_TYPES = ['Advance', 'Partial', 'Final'] as const;
export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Other'] as const;

export const EXPENSE_CATEGORIES = [
  'Printing/Paper',
  'Transport',
  'Staff/Attendant',
  'Venue',
  'Equipment',
  'Props',
  'Maintenance',
  'Marketing',
  'Miscellaneous',
  'Other',
] as const;

export const LOG_KINDS = ['note', 'call', 'whatsapp', 'meeting'] as const;

export const DEFAULT_GALLERY_CATEGORIES = ['Weddings', 'Festivals', 'Corporate', 'Parties'] as const;

/** Website form submissions wait here until an admin approves them (never shown as a normal inquiry status). */
export const PENDING_STATUS = 'Pending approval';

/** Statuses that are still "open" in the sales pipeline. */
export const OPEN_STATUSES: readonly string[] = ['New'];
