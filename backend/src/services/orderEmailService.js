const { sendEmail } = require('./emailService');

const formatCurrency = (value) => `₹${Number(value || 0).toFixed(2)}`;

const shouldSendOrderEmail = (order) => {
  const paymentStatus = String(order?.paymentStatus || '').toLowerCase();
  if (!paymentStatus) return true;
  return paymentStatus !== 'pending' && paymentStatus !== 'failed';
};

const getOrderSummaryHtml = (order) => {
  const itemCount = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return `
    <p style="margin:0 0 10px;font-size:14px;color:#374151;">
      Thank you for ordering with FarmyCure Naturals. Your order has been successfully placed.
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#111827;"><strong>Order ID:</strong> ${String(order._id)}</p>
    <p style="margin:0 0 8px;font-size:14px;color:#111827;"><strong>Items:</strong> ${itemCount}</p>
    <p style="margin:0 0 12px;font-size:14px;color:#111827;"><strong>Total:</strong> ${formatCurrency(order.totalPrice)}</p>
    <p style="margin:0;font-size:13px;color:#6b7280;">Your invoice is attached to this email.</p>
  `;
};

const sendOrderEmail = async (order, pdfBuffer, toEmail) => {
  if (!shouldSendOrderEmail(order)) {
    return { skipped: true, reason: 'Payment status is pending or failed' };
  }
  if (!toEmail) {
    return { skipped: true, reason: 'Customer email missing' };
  }
  const subject = 'Your Order Confirmation - FarmyCure Naturals';
  const html = `
    <div style="background:#f6f8fa;padding:24px;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <div style="background:#1f4d36;padding:18px 24px;color:#ffffff;">
          <h1 style="margin:0;font-size:20px;">FarmyCure Naturals</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="margin:0 0 12px;font-size:18px;color:#111827;">Order Confirmation</h2>
          ${getOrderSummaryHtml(order)}
        </div>
      </div>
    </div>
  `;

  return sendEmail({
    to: toEmail,
    subject,
    html,
    attachments: [
      {
        filename: `invoice_${String(order._id)}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const sendOrderEmailWithRetry = async (
  order,
  pdfBuffer,
  toEmail,
  { maxRetries = 1, retryDelayMs = 3000 } = {}
) => {
  let attempt = 0;
  let lastError = null;
  const totalAttempts = Math.max(1, Number(maxRetries) + 1);

  while (attempt < totalAttempts) {
    try {
      const result = await sendOrderEmail(order, pdfBuffer, toEmail);
      return { ...result, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= totalAttempts) break;
      console.log('Order email send failed, retrying...', {
        orderId: String(order?._id || ''),
        attempt,
        nextAttempt: attempt + 1,
        retryDelayMs,
        error: error?.message || 'Unknown email error',
      });
      await sleep(retryDelayMs);
    }
  }

  throw lastError || new Error('Order email send failed after retries');
};

module.exports = {
  sendOrderEmail,
  sendOrderEmailWithRetry,
  shouldSendOrderEmail,
};
