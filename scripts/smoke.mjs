// End-to-end API smoke test. Usage: node scripts/smoke.mjs [baseUrl]
const BASE = process.argv[2] ?? 'http://localhost:4100';
let cookie = '';
let failed = 0;

async function call(method, path, body, { raw = false, auth = true } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth && cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  if (raw) return res;
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}
function check(name, cond, extra = '') {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`);
}

// --- security ---
let r = await call('GET', '/api/admin/dashboard', null, { auth: false });
check('admin API rejects unauthenticated', r.status === 401);
r = await call('GET', '/api/admin/expenses/1/receipt', null, { auth: false });
check('receipts rejected when unauthenticated', r.status === 401);
r = await call('POST', '/api/auth/login', { email: 'owner@pal.test', password: 'wrong' }, { auth: false });
check('bad login rejected', r.status === 401);
r = await call('POST', '/api/auth/login', { email: 'owner@pal.test', password: 'TestPass123' });
check('login ok', r.status === 200 && cookie.startsWith('pal_session='), JSON.stringify(r.json));

// --- public ---
r = await call('GET', '/api/public/site', null, { auth: false });
check('public site payload', r.status === 200 && r.json.packages.length === 3 && r.json.faqs.length === 9, JSON.stringify(r.json).slice(0, 200));
check('packages priced', r.json.packages.map((p) => p.price).join() === '15000,22000,25000');
r = await call('POST', '/api/public/inquiry', { customer_name: 'Riya Shah', phone: '98250 12345', event_type: 'Wedding', event_date: '2026-12-10', start_time: '19:00', duration_hours: 4, location: 'Vadodara', guest_count: 300, package_code: 'PLUS', notes: 'Sangeet night' }, { auth: false });
check('public inquiry saved', r.status === 201 && r.json.reference?.startsWith('PAL-'), JSON.stringify(r.json));
r = await call('POST', '/api/public/inquiry', { customer_name: 'Bot', phone: '9825012345', event_type: 'Wedding', website: 'spam' }, { auth: false });
check('honeypot blocks bots', r.status === 400);
r = await call('POST', '/api/public/inquiry', { customer_name: '', phone: '1', event_type: 'Wedding' }, { auth: false });
check('public validation', r.status === 400);

// --- inquiries ---
r = await call('GET', '/api/admin/inquiries');
check('website inquiry visible in CRM', r.json.length === 1 && r.json[0].source === 'Website' && r.json[0].quoted_price === 22000, JSON.stringify(r.json[0]));
const inqId = r.json[0].id;
r = await call('POST', '/api/admin/inquiries', { customer_name: 'Amit Patel', phone: '9876543210', event_type: 'Corporate', event_date: '2026-11-05', package_code: 'MINI', quoted_price: 15000, source: 'Phone Call' });
check('manual inquiry created', r.status === 201);
const inq2 = r.json.id;
r = await call('PATCH', `/api/admin/inquiries/${inq2}`, { status: 'Lost' });
check('status update + system log', r.json.inquiry.status === 'Lost' && r.json.logs.some((l) => l.body.includes('New → Lost')), JSON.stringify(r.json.logs));
r = await call('POST', `/api/admin/inquiries/${inq2}/logs`, { kind: 'call', body: 'Called, wants quote' });
check('interaction log added', r.json.logs.length === 2);
r = await call('POST', '/api/admin/followups', { inquiry_id: inq2, due_date: '2000-01-01', note: 'overdue test' });
check('followup created', r.status === 201);
const fuId = r.json.id;
r = await call('GET', '/api/admin/followups');
check('overdue followup bucketed', r.json.overdue.length === 1);
r = await call('GET', '/api/admin/inquiries?overdue=1');
check('overdue filter', r.json.length === 1);
r = await call('GET', '/api/admin/inquiries?search=9876&status=Lost&sort=quoted_price&dir=desc');
check('search+filter+sort', r.json.length === 1);
r = await call('POST', `/api/admin/followups/${fuId}/complete`, {});
check('followup completed', r.status === 200);

// --- booking + finance ---
r = await call('POST', `/api/admin/inquiries/${inqId}/convert`, { final_amount: 22000, advance_paid: 5000, advance_method: 'UPI' });
check('convert to booking', r.status === 201 && r.json.payment_status === 'Advance Paid' && r.json.remaining === 17000, JSON.stringify(r.json));
const evId = r.json.id;
check('end time derived', r.json.end_time === '23:00', String(r.json.end_time));
r = await call('POST', `/api/admin/inquiries/${inqId}/convert`, { final_amount: 1 });
check('double convert blocked', r.status === 409);
r = await call('GET', `/api/admin/inquiries/${inqId}`);
check('inquiry is Confirmed', r.json.inquiry.status === 'Confirmed');

r = await call('POST', `/api/admin/events/${evId}/payments`, { amount: 7000, type: 'Partial', method: 'Cash' });
check('partial payment', r.json.event.payment_status === 'Partially Paid' && r.json.event.paid === 12000, JSON.stringify(r.json.event));
r = await call('POST', '/api/admin/expenses', { name: 'Paper rolls', amount: 2500, category: 'Printing/Paper', event_id: evId, spent_on: '2026-12-09' });
check('event expense', r.status === 201);
r = await call('POST', '/api/admin/expenses', { name: 'Instagram ads', amount: 1000, category: 'Marketing', spent_on: '2026-12-01' });
check('general expense', r.status === 201);
r = await call('POST', '/api/admin/expenses', { name: 'x', amount: 5, event_id: 9999 });
check('expense bad event rejected', r.status === 400);
r = await call('GET', `/api/admin/events/${evId}`);
check('event financials', r.json.event.expenses_total === 2500 && r.json.event.estimated_profit === 19500 && r.json.event.realized_profit === null, JSON.stringify(r.json.event));
r = await call('PATCH', `/api/admin/events/${evId}`, { booking_status: 'Completed' });
check('complete event', r.json.event.realized_profit === 12000 - 2500, JSON.stringify(r.json.event.realized_profit));
r = await call('GET', `/api/admin/inquiries/${inqId}`);
check('inquiry follows completed booking', r.json.inquiry.status === 'Completed', r.json.inquiry.status);
r = await call('GET', '/api/admin/inquiries?open=1');
check('completed inquiry not open', !r.json.some((i) => i.id === inqId));
r = await call('GET', '/api/admin/inquiries');
check('completed inquiry hidden from default list', !r.json.some((i) => i.id === inqId));
r = await call('GET', '/api/admin/inquiries?status=Completed');
check('completed inquiry found via status filter', r.json.some((i) => i.id === inqId));

r = await call('POST', `/api/admin/events/${evId}/payments`, { amount: 10000, type: 'Final' });
check('fully paid', r.json.event.payment_status === 'Fully Paid' && r.json.event.remaining === 0);

r = await call('GET', '/api/admin/finance');
const s = r.json.summary;
check('finance summary', s.booked_revenue === 22000 && s.cash_received === 22000 && s.outstanding === 0 && s.total_expenses === 3500 && s.net_profit === 18500, JSON.stringify(s));
r = await call('GET', '/api/admin/finance?from=2026-12-01&to=2026-12-31');
check('finance date filter', r.json.summary.total_expenses === 3500);
r = await call('GET', '/api/admin/dashboard');
check('dashboard metrics', r.json.metrics.total_inquiries === 1 && r.json.metrics.completed_events === 1 && r.json.pipeline.length === 4, JSON.stringify(r.json.metrics));
r = await call('GET', '/api/admin/calendar?from=2026-12-01&to=2026-12-31');
check('calendar feed', r.json.some((e) => e.kind === 'event'));
r = await call('GET', '/api/admin/reports/event-breakdown?format=csv', null, { raw: true });
const csv = await r.text();
check('csv export', r.status === 200 && csv.includes('Realized Profit') && csv.includes('Riya Shah'), csv.slice(0, 200));

// --- invoice download tests ---
r = await call('GET', `/api/admin/events/${evId}/invoice`, null, { raw: true });
const invBuf = await r.arrayBuffer();
check('invoice download completed booking', r.status === 200 && (r.headers.get('content-type') || '').includes('application/pdf') && invBuf.byteLength > 1000);

await call('PATCH', `/api/admin/events/${evId}`, { booking_status: 'Cancelled' });
r = await call('GET', `/api/admin/events/${evId}/invoice`, null, { raw: true });
check('invoice download blocked for cancelled booking', r.status === 400);

await call('PATCH', `/api/admin/events/${evId}`, { booking_status: 'Confirmed' });
r = await call('GET', `/api/admin/events/${evId}/invoice`, null, { raw: true });
check('invoice download confirmed booking', r.status === 200 && (r.headers.get('content-type') || '').includes('application/pdf'));

// restore to Completed
await call('PATCH', `/api/admin/events/${evId}`, { booking_status: 'Completed' });

// --- content ---
r = await call('PATCH', '/api/admin/content/packages/2', { price: 23000, features: ['A', 'B'] });
check('package edit', r.json.price === 23000);
r = await call('GET', '/api/public/site', null, { auth: false });
check('package edit reflected publicly', r.json.packages[1].price === 23000 && r.json.packages[1].features.length === 2);
r = await call('GET', '/api/public/site', null, { auth: false });
check('no admin data in public payload', !JSON.stringify(r.json).includes('Riya'));

// --- deletion keeps booking ---
r = await call('DELETE', `/api/admin/inquiries/${inqId}`);
r = await call('GET', `/api/admin/events/${evId}`);
check('booking survives inquiry deletion', r.status === 200 && r.json.event.inquiry_id === null);

r = await call('POST', '/api/auth/logout', {});
r = await call('GET', '/api/admin/dashboard');
check('logout invalidates session', r.status === 401);

console.log(failed ? `\n${failed} FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
