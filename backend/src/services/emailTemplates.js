const BRAND = 'FarmyCure Naturals';

const formatCurrency = (value) => `INR ${Number(value || 0).toFixed(2)}`;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const wrapLayout = ({ title, intro, bodyHtml }) => `
  <div style="background:#f6f8fa;padding:24px;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <div style="background:#1f4d36;padding:18px 24px;color:#ffffff;">
        <h1 style="margin:0;font-size:20px;">${BRAND}</h1>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 10px;font-size:18px;color:#111827;">${escapeHtml(title)}</h2>
        <p style="margin:0 0 18px;color:#4b5563;line-height:1.6;">${escapeHtml(intro)}</p>
        ${bodyHtml}
      </div>
      <div style="padding:14px 24px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
        This is an automated message from ${BRAND}.
      </div>
    </div>
  </div>
`;

const addressToText = (address) => {
  if (!address) return 'N/A';
  if (typeof address === 'string') return address;
  return [
    address.fullName || address.name,
    address.address,
    [address.city, address.state].filter(Boolean).join(', '),
    address.pincode,
    address.phone ? `Phone: ${address.phone}` : '',
  ]
    .filter(Boolean)
    .join(', ');
};

const orderItemsTable = (items = []) =>
  `
  <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;">
    <thead>
      <tr>
        <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;background:#f9fafb;">Product</th>
        <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;background:#f9fafb;">Qty</th>
        <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;background:#f9fafb;">Price</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item) => `
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(item.title || item.productId?.title || item.productId?.name || 'Product')}</td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(item.quantity)}</td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(formatCurrency(item.price))}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>
`;

const orderConfirmationTemplate = ({ customerName, orderId, items, totalAmount, deliveryAddress }) => ({
  subject: `Order Confirmed - ${orderId}`,
  html: wrapLayout({
    title: 'Your order has been confirmed',
    intro: `Hi ${customerName || 'Customer'}, thank you for your order. We are preparing it now.`,
    bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>
      ${orderItemsTable(items)}
      <p style="margin:0 0 8px;"><strong>Total Amount:</strong> ${escapeHtml(formatCurrency(totalAmount))}</p>
      <p style="margin:0;"><strong>Delivery Address:</strong> ${escapeHtml(addressToText(deliveryAddress))}</p>
    `,
  }),
});

const orderStatusTemplate = ({ customerName, orderId, status, trackingLink }) => ({
  subject: `Order Update - ${status} (${orderId})`,
  html: wrapLayout({
    title: 'Order status updated',
    intro: `Hi ${customerName || 'Customer'}, your order status has changed to ${status}.`,
    bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>
      <p style="margin:0 0 8px;"><strong>Current Status:</strong> ${escapeHtml(status)}</p>
      ${
        trackingLink
          ? `<p style="margin:0;"><strong>Tracking Link:</strong> <a href="${escapeHtml(
              trackingLink
            )}" target="_blank" rel="noreferrer">Track your shipment</a></p>`
          : ''
      }
    `,
  }),
});

const contactUserTemplate = ({ name, subject }) => ({
  subject: `We received your message${subject ? ` - ${subject}` : ''}`,
  html: wrapLayout({
    title: 'Thank you for contacting us',
    intro: `Hi ${name || 'there'}, we have received your message and our team will get back to you soon.`,
    bodyHtml: `<p style="margin:0;">We appreciate your interest in ${BRAND}.</p>`,
  }),
});

const contactAdminTemplate = ({ name, email, subject, message }) => ({
  subject: `New Contact Form Submission${subject ? ` - ${subject}` : ''}`,
  html: wrapLayout({
    title: 'New contact form submission',
    intro: 'A user submitted the contact form.',
    bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p style="margin:0 0 8px;"><strong>Subject:</strong> ${escapeHtml(subject || '-')}</p>
      <p style="margin:0;"><strong>Message:</strong><br/>${escapeHtml(message || '-')}</p>
    `,
  }),
});

const tradeUserTemplate = ({ name }) => ({
  subject: 'Trade Request Received - FarmyCure Naturals',
  html: wrapLayout({
    title: 'Thank you for your trade request',
    intro: `Hi ${name || 'there'}, we have received your trade enquiry and our team will contact you shortly.`,
    bodyHtml: `<p style="margin:0;">Thank you for choosing ${BRAND}.</p>`,
  }),
});

const tradeAdminTemplate = ({ companyName, contactPerson, email, phone, message }) => ({
  subject: `New Trade Form Submission - ${companyName || contactPerson || 'Unknown Company'}`,
  html: wrapLayout({
    title: 'New trade enquiry received',
    intro: 'A new trade enquiry has been submitted.',
    bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Company:</strong> ${escapeHtml(companyName || '-')}</p>
      <p style="margin:0 0 8px;"><strong>Contact Person:</strong> ${escapeHtml(contactPerson || '-')}</p>
      <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(email || '-')}</p>
      <p style="margin:0 0 8px;"><strong>Phone:</strong> ${escapeHtml(phone || '-')}</p>
      <p style="margin:0;"><strong>Message:</strong><br/>${escapeHtml(message || '-')}</p>
    `,
  }),
});

const otpVerificationTemplate = ({ otp, expiresInMinutes = 5 }) => ({
  subject: 'Your OTP for verification',
  html: wrapLayout({
    title: 'OTP Verification',
    intro: 'Use the one-time password below to complete your verification.',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">
        This OTP is valid for ${escapeHtml(expiresInMinutes)} minutes and can only be used once.
      </p>
      <div style="margin:10px 0 16px;padding:14px 18px;border:1px dashed #9ca3af;border-radius:8px;background:#f9fafb;text-align:center;">
        <span style="font-size:28px;letter-spacing:6px;font-weight:700;color:#111827;">${escapeHtml(otp)}</span>
      </div>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you did not request this, please ignore this email.
      </p>
    `,
  }),
});

const passwordResetTemplate = ({ resetLink, expiresInMinutes = 15 }) => ({
  subject: 'Password Reset Request - FarmyCure Naturals',
  html: wrapLayout({
    title: 'Reset your password',
    intro: 'We received a request to reset your password.',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">
        Click the button below to set a new password. This link is valid for ${escapeHtml(expiresInMinutes)} minutes.
      </p>
      <p style="margin:0 0 16px;">
        <a href="${escapeHtml(
          resetLink
        )}" target="_blank" rel="noreferrer" style="display:inline-block;padding:10px 16px;background:#1f4d36;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
          Reset Password
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">If the button does not work, use this link:</p>
      <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${escapeHtml(
        resetLink
      )}" target="_blank" rel="noreferrer">${escapeHtml(resetLink)}</a></p>
    `,
  }),
});

module.exports = {
  orderConfirmationTemplate,
  orderStatusTemplate,
  contactUserTemplate,
  contactAdminTemplate,
  tradeUserTemplate,
  tradeAdminTemplate,
  otpVerificationTemplate,
  passwordResetTemplate,
};
