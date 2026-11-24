import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { byId, list } from './db.ts';
import { getEvent, type DecoratedEvent } from './domain.ts';
import { HttpError } from './util.ts';

const TERMS_URL = 'https://docs.google.com/document/d/1QgFASeN2yPszI1D0s8TxLIr6rclHbExUpzTpV60Z0Cc/edit?tab=t.0#heading=h.c9ceffr4p5wa';

function fmtDocDate(dStr?: string | null): string {
  if (!dStr) return '—';
  const clean = dStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }
  return dStr;
}

function fmtDocTime(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const ap = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ap}`;
}

function fmtInr(amount: number): string {
  return 'Rs. ' + Number(amount || 0).toLocaleString('en-IN');
}

export async function generateInvoicePdf(eventId: number): Promise<{ buffer: Buffer; filename: string }> {
  const event = await getEvent(eventId);
  if (!event) throw new HttpError(404, 'Booking not found');

  if (!['Confirmed', 'Completed'].includes(event.booking_status)) {
    throw new HttpError(400, 'Invoices can only be downloaded for Confirmed or Completed bookings.');
  }

  const [payments, inq] = await Promise.all([
    list('event_payments', { event_id: eventId }, { paid_on: 1, _id: 1 }),
    event.inquiry_id ? byId('inquiries', event.inquiry_id) : Promise.resolve(null),
  ]);

  const year = event.event_date ? event.event_date.slice(0, 4) : new Date().getFullYear().toString();
  const invoiceNo = `PAL-${year}-${String(event.id).padStart(3, '0')}`;
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const invoiceDate = fmtDocDate(todayIso);

  const customerName = event.client_name || '—';
  const eventName = event.event_type ? `${event.event_type} Event` : 'Event';
  const contactPerson = event.client_name || '—';
  const eventDate = fmtDocDate(event.event_date);
  const mobile = event.phone || '—';

  let timings = '—';
  if (event.start_time && event.end_time) {
    timings = `${fmtDocTime(event.start_time)} to ${fmtDocTime(event.end_time)}`;
  } else if (event.start_time) {
    timings = fmtDocTime(event.start_time);
  }

  const email = (inq as any)?.email || '—';
  const venueName = event.venue_name || (event.location ? event.location.split(',')[0].trim() : '—');
  const location = event.location || event.venue_name || '—';
  const duration = event.duration_hours ? `${event.duration_hours} hours` : '—';

  const pkgCode = (event.package_code || '').toUpperCase();
  const isMini = pkgCode === 'MINI';
  const isPlus = pkgCode === 'PLUS';
  const isPremium = pkgCode === 'PREMIUM';

  const totalAmount = fmtInr(event.final_amount);
  const advancePaid = fmtInr(event.paid);
  const balanceDue = fmtInr(event.remaining);

  const firstPayment = payments[0];
  const advancePaymentDate = firstPayment?.paid_on ? fmtDocDate(firstPayment.paid_on) : '—';
  const paymentMethods = Array.from(new Set(payments.map((p: any) => p.method).filter(Boolean))).join(', ');
  const paymentMethod = paymentMethods || (firstPayment?.method ?? '—');
  const paymentStatus = event.payment_status || '—';

  // 1 for unpaid, 2 for partially paid, 3 for fully paid
  let statusCode = '1';
  if (event.payment_status === 'Fully Paid' || (event.final_amount > 0 && event.paid >= event.final_amount)) {
    statusCode = '3';
  } else if (event.payment_status === 'Partially Paid' || event.payment_status === 'Advance Paid' || event.paid > 0) {
    statusCode = '2';
  } else {
    statusCode = '1';
  }

  const isFullyPaid = statusCode === '3';
  const filename = `${invoiceNo}_${statusCode}.pdf`;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36, autoFirstPage: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, filename });
      });
      doc.on('error', (err) => reject(err));

      const pageWidth = 595.28;
      const left = 36;
      const right = pageWidth - 36;
      const contentWidth = right - left; // 523.28

      function sectionHead(y: number, title: string, w = contentWidth, x = left) {
        doc.rect(x, y + 2, 7, 7).fill('#FFDE59');
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#0B1B3F').text(title, x + 12, y);
        doc.moveTo(x, y + 14).lineTo(x + w, y + 14).strokeColor('#DDE2EE').lineWidth(0.75).stroke();
      }

      // 1. Top Accent Stripe
      doc.rect(left, 26, contentWidth, 3).fill('#FFDE59');

      // 2. Header
      const headY = 38;
      const logoPath = path.resolve(process.cwd(), 'public', 'logo.png');
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, left, headY, { height: 44 });
        } catch {
          doc.font('Helvetica-Bold').fontSize(22).fillColor('#171717').text('PAL', left, headY);
        }
      } else {
        doc.font('Helvetica-Bold').fontSize(22).fillColor('#171717').text('PAL', left, headY);
      }

      doc.font('Helvetica-Bold').fontSize(15).fillColor('#0B1B3F')
        .text('BOOKING INVOICE', left, headY + 3, { align: 'right', width: contentWidth });
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0B1B3F')
        .text('& CONFIRMATION', left, headY + 20, { align: 'right', width: contentWidth });
      doc.rect(right - 85, headY + 38, 85, 2).fill('#FFDE59');

      // 3. Metadata Bar (3 rounded cards)
      const metaY = 94;
      const metaColW = (contentWidth - 14) / 3;
      const metaH = 40;
      const metaBoxes = [
        { label: 'INVOICE NUMBER', val: invoiceNo, bold: true },
        { label: 'INVOICE DATE', val: invoiceDate, bold: false },
        { label: 'BOOKING STATUS', val: event.booking_status, bold: true },
      ];

      metaBoxes.forEach((b, i) => {
        const bx = left + i * (metaColW + 7);
        doc.roundedRect(bx, metaY, metaColW, metaH, 5).fill('#F3F5FA');
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#5F6B85')
          .text(b.label, bx + 10, metaY + 7, { width: metaColW - 20 });
        doc.font(b.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10.5).fillColor('#0B1B3F')
          .text(b.val, bx + 10, metaY + 20, { width: metaColW - 20 });
      });

      // 4. Two-Column Customer & Event Details
      const detHeadY = 146;
      const halfW = (contentWidth - 14) / 2;
      const col2X = left + halfW + 14;

      sectionHead(detHeadY, 'Customer Details', halfW, left);
      sectionHead(detHeadY, 'Event Details', halfW, col2X);

      const startDetY = detHeadY + 20;

      // Left Details
      const leftFields = [
        { label: 'CUSTOMER / COMPANY NAME', val: customerName },
        { label: 'CONTACT PERSON', val: contactPerson },
        { label: 'MOBILE NUMBER', val: mobile },
        { label: 'EMAIL ADDRESS', val: email },
      ];

      let ly = startDetY;
      leftFields.forEach((f) => {
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#5F6B85').text(f.label, left, ly, { width: halfW });
        ly += 9;
        doc.font('Helvetica').fontSize(9).fillColor('#171717').text(f.val, left, ly, { width: halfW });
        ly += 13;
        doc.moveTo(left, ly - 2).lineTo(left + halfW, ly - 2).strokeColor('#EAEAEA').lineWidth(0.5).stroke();
        ly += 4;
      });

      // Right Details
      const rightFields = [
        { label: 'EVENT NAME', val: eventName },
        { label: 'EVENT DATE', val: eventDate },
        { label: 'EVENT TIMINGS', val: timings },
        { label: 'VENUE NAME', val: venueName },
        { label: 'COMPLETE VENUE ADDRESS', val: location },
        { label: 'BOOKING DURATION', val: duration },
      ];

      let ry = startDetY;
      rightFields.forEach((f) => {
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#5F6B85').text(f.label, col2X, ry, { width: halfW });
        ry += 9;
        doc.font('Helvetica').fontSize(9).fillColor('#171717').text(f.val, col2X, ry, { width: halfW });
        ry += 13;
        doc.moveTo(col2X, ry - 2).lineTo(col2X + halfW, ry - 2).strokeColor('#EAEAEA').lineWidth(0.5).stroke();
        ry += 4;
      });

      // 5. Package Selected Section
      const pkgHeadY = Math.max(ly, ry) + 8;
      sectionHead(pkgHeadY, 'Package Selected', contentWidth, left);

      const pkgCardsY = pkgHeadY + 20;
      const pkgColW = (contentWidth - 18) / 4;
      const pkgH = 34;

      const pkgList = [
        { name: 'PAL Mini', checked: isMini },
        { name: 'PAL Plus', checked: isPlus },
        { name: 'PAL Premium', checked: isPremium },
        { name: 'Additional Requirement', checked: false, isAdditional: true },
      ];

      pkgList.forEach((p, i) => {
        const px = left + i * (pkgColW + 6);
        const isChecked = p.checked;
        doc.roundedRect(px, pkgCardsY, pkgColW, pkgH, 5)
          .fillAndStroke(isChecked ? '#EAF4FF' : '#F3F5FA', isChecked ? '#153B50' : '#E5E7EB');

        if (!p.isAdditional) {
          const cbX = px + 8;
          const cbY = pkgCardsY + 10;
          doc.rect(cbX, cbY, 13, 13).fillAndStroke(isChecked ? '#153B50' : '#FFFFFF', '#153B50');
          if (isChecked) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF').text('X', cbX + 2.5, cbY + 1.5, { lineBreak: false });
          }
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0B1B3F').text(p.name, px + 26, pkgCardsY + 12, { width: pkgColW - 30, lineBreak: false });
        } else {
          doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#5F6B85').text('ADDITIONAL REQUIREMENT', px + 6, pkgCardsY + 6, { width: pkgColW - 12 });
          // Additional requirements box kept empty as requested
        }
      });

      // 6. Payment Summary Section
      const payHeadY = pkgCardsY + pkgH + 14;
      sectionHead(payHeadY, 'Payment Summary', contentWidth, left);

      // PAID badge if fully paid
      if (isFullyPaid) {
        const badgeW = 52;
        const badgeH = 16;
        const badgeX = right - badgeW;
        const badgeY = payHeadY - 1;
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 4).fill('#3B8C69');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
          .text('PAID', badgeX, badgeY + 3.5, { width: badgeW, align: 'center', lineBreak: false });
      }

      const payCardsY = payHeadY + 20;
      const payColW = (contentWidth - 14) / 3;
      const payH = 46;

      // Card 1: Total
      doc.roundedRect(left, payCardsY, payColW, payH, 5).fill('#F3F5FA');
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#5F6B85').text('TOTAL BOOKING AMOUNT', left + 10, payCardsY + 7);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0B1B3F').text(totalAmount, left + 10, payCardsY + 22);

      // Card 2: Advance Paid
      const c2X = left + payColW + 7;
      doc.roundedRect(c2X, payCardsY, payColW, payH, 5).fill('#F3F5FA');
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#5F6B85').text('ADVANCE PAID', c2X + 10, payCardsY + 7);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#3B8C69').text(advancePaid, c2X + 10, payCardsY + 22);

      // Card 3: Balance Due
      const c3X = left + (payColW + 7) * 2;
      doc.roundedRect(c3X, payCardsY, payColW, payH, 5).fill(isFullyPaid ? '#153B50' : '#0B1B3F');
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#C9D3EE').text('BALANCE DUE', c3X + 10, payCardsY + 7);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF').text(balanceDue, c3X + 10, payCardsY + 22);

      // 3 sub lines
      const subY = payCardsY + payH + 7;
      const subItems = [
        { label: 'ADVANCE PAYMENT DATE', val: advancePaymentDate },
        { label: 'PAYMENT METHOD', val: paymentMethod },
        { label: 'FINAL PAYMENT STATUS', val: paymentStatus },
      ];

      subItems.forEach((item, i) => {
        const sx = left + i * (payColW + 7);
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#5F6B85').text(item.label, sx + 2, subY);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#171717').text(item.val, sx + 2, subY + 9);
      });

      // 7. Non-GST Callout Note
      const noteY = subY + 28;
      doc.rect(left, noteY, 3, 20).fill('#FFDE59');
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#444444')
        .text('The booking is confirmed upon receipt of the agreed payment. This is non-GST invoice.', left + 10, noteY + 5);

      // 8. Terms & Conditions
      const termsHeadY = noteY + 30;
      sectionHead(termsHeadY, 'Terms & Conditions', contentWidth, left);

      const termsLinkY = termsHeadY + 20;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1A56DB')
        .text('Terms and Conditions', left, termsLinkY, {
          link: TERMS_URL,
          underline: true,
          lineBreak: false,
        });
      doc.font('Helvetica').fontSize(7.5).fillColor('#5F6B85')
        .text('(Click above to view our complete service terms & operational guidelines)', left + 110, termsLinkY + 1.5);

      // 9. Brand Tagline
      const tagY = termsLinkY + 36;
      doc.rect(left + contentWidth / 2 - 50, tagY, 100, 2).fill('#FFDE59');
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0B1B3F')
        .text("Thank you for choosing PAL. Let's make your moments memorable!", left, tagY + 10, {
          align: 'center',
          width: contentWidth,
        });

      // 10. Bottom Footer
      const footerY = 800;
      doc.moveTo(left, footerY - 12).lineTo(right, footerY - 12).strokeColor('#DDE2EE').lineWidth(0.75).stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor('#5F6B85')
        .text('PAL - Click it   |   Instagram: @palclickit   |   Email: palclickitofficial@gmail.com', left, footerY - 4, {
          align: 'center',
          width: contentWidth,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
