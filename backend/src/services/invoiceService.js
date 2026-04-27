const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const formatCurrency = (value) => `₹${Number(value || 0).toFixed(2)}`;
const normalizeAddress = (address) => {
  if (!address) return 'N/A';
  if (typeof address === 'string') return address;
  const parts = [
    address.fullName,
    address.address,
    [address.city, address.state].filter(Boolean).join(', '),
    address.pincode,
    address.phone && `Phone: ${address.phone}`,
    address.email,
  ].filter(Boolean);
  return parts.join(', ') || 'N/A';
};
const getInvoiceGstPercent = () => {
  const raw = Number(process.env.INVOICE_GST_PERCENT);
  if (!Number.isFinite(raw) || raw < 0) return null;
  return raw;
};
const getInvoiceNumber = (order) => {
  const dateStamp = new Date(order.createdAt || Date.now()).toISOString().slice(0, 10).replace(/-/g, '');
  const orderFragment = String(order._id || '').slice(-6).toUpperCase();
  return `INV-${dateStamp}-${orderFragment}`;
};
const getCustomerDetails = (order) => {
  const shipping = order.shippingAddress || {};
  const customerName = shipping.fullName || order.user?.name || 'N/A';
  const deliveryAddress =
    [shipping.address, shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(', ') ||
    normalizeAddress(shipping);
  return {
    customerName,
    deliveryAddress,
    phone: shipping.phone || 'N/A',
    email: shipping.email || 'N/A',
  };
};
const resolveInvoiceLogoPath = () => {
  const configuredPath = String(process.env.INVOICE_LOGO_PATH || '').trim();
  const candidates = [
    configuredPath,
    path.resolve(__dirname, '../../../user_frontend/src/assets/icons/Logo.png'),
    path.resolve(__dirname, '../../../user_frontend/src/assets/icons/logo.png'),
    path.resolve(__dirname, '../../../user_frontend/src/assets/icons/Logo.jpg'),
    path.resolve(__dirname, '../../../user_frontend/src/assets/icons/logo.jpg'),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const renderInvoice = (doc, order) => {
  const brandColor = '#1f4d36';
  const lightBorder = '#d9d9d9';
  const subtleText = '#666666';
  const left = 50;
  const right = 545;
  const contentWidth = right - left;
  const serialX = 60;
  const productX = 92;
  const quantityX = 332;
  const priceX = 395;
  const totalX = 472;
  const lineGap = 22;
  const rowHeight = 24;
  const logoPath = resolveInvoiceLogoPath();
  const invoiceNumber = getInvoiceNumber(order);
  const customer = getCustomerDetails(order);
  const subtotal = (order.items || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  const finalTotal = Number(order.totalPrice || subtotal || 0);
  const taxAmount = Math.max(finalTotal - subtotal, 0);
  const gstPercent = getInvoiceGstPercent();
  const taxLabel = gstPercent === null ? 'GST/Tax' : `GST (${gstPercent}%)`;

  const headerTop = 50;
  if (logoPath) {
    try {
      doc.image(logoPath, left, headerTop, { width: 56, height: 56 });
    } catch {
      doc
        .rect(left, headerTop, 56, 56)
        .fillColor(brandColor)
        .fill()
        .fillColor('white')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('FC', left, headerTop + 20, { width: 56, align: 'center' });
    }
  } else {
    doc
      .rect(left, headerTop, 56, 56)
      .fillColor(brandColor)
      .fill()
      .fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('FC', left, headerTop + 20, { width: 56, align: 'center' });
  }

  doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(18).text('FarmyCure Naturals', left + 68, headerTop + 8, {
    width: 240,
  });
  doc
    .fillColor(subtleText)
    .font('Helvetica')
    .fontSize(10)
    .text('support@farmycure.com', right - 180, headerTop + 10, { width: 180, align: 'right' })
    .text('+91 90000 00000', right - 180, headerTop + 26, { width: 180, align: 'right' });
  doc.moveTo(left, headerTop + 72).lineTo(right, headerTop + 72).lineWidth(1).strokeColor(lightBorder).stroke();

  doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(28).text('INVOICE', left, headerTop + 88, { width: contentWidth });
  doc
    .fillColor(subtleText)
    .font('Helvetica')
    .fontSize(10)
    .text(`Invoice No: ${invoiceNumber}`, left, headerTop + 124)
    .text(`Order ID: ${order._id}`, left, headerTop + 140)
    .text(`Date: ${new Date(order.createdAt).toLocaleString()}`, left, headerTop + 156);

  const customerTop = headerTop + 190;
  doc.roundedRect(left, customerTop, contentWidth, 92, 6).lineWidth(1).strokeColor(lightBorder).stroke();
  doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(11).text('BILL TO', left + 12, customerTop + 10);
  doc
    .fillColor('#111111')
    .font('Helvetica')
    .fontSize(10)
    .text(`Customer Name: ${customer.customerName}`, left + 12, customerTop + 30, { width: contentWidth / 2 - 18 })
    .text(`Delivery Address: ${customer.deliveryAddress}`, left + 12, customerTop + 48, { width: contentWidth / 2 - 18 });
  doc
    .text(`Phone: ${customer.phone}`, left + contentWidth / 2 + 6, customerTop + 30, { width: contentWidth / 2 - 18 })
    .text(`Email: ${customer.email}`, left + contentWidth / 2 + 6, customerTop + 48, { width: contentWidth / 2 - 18 });

  const tableTop = customerTop + 120;
  doc.rect(left, tableTop, contentWidth, 28).fillColor('#eef5f1').fill();
  doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(10);
  doc.text('#', serialX, tableTop + 9, { width: 24, align: 'center' });
  doc.text('Product', productX, tableTop + 9, { width: 228 });
  doc.text('Quantity', quantityX, tableTop + 9, { width: 58, align: 'right' });
  doc.text('Price', priceX, tableTop + 9, { width: 70, align: 'right' });
  doc.text('Total', totalX, tableTop + 9, { width: 65, align: 'right' });
  doc.rect(left, tableTop, contentWidth, 28).lineWidth(1).strokeColor(lightBorder).stroke();

  let currentY = tableTop + 28;
  (order.items || []).forEach((item, idx) => {
    const productName = item.productId?.title || item.productId?.name || 'Product';
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const rowTotal = qty * price;
    if (idx % 2 === 1) {
      doc.rect(left, currentY, contentWidth, rowHeight).fillColor('#fbfbfb').fill();
    }
    doc
      .fillColor('#111111')
      .font('Helvetica')
      .fontSize(10)
      .text(String(idx + 1), serialX, currentY + 7, { width: 24, align: 'center' })
      .text(productName, productX, currentY + 7, { width: 228, lineBreak: false })
      .text(String(qty), quantityX, currentY + 7, { width: 58, align: 'right' })
      .text(formatCurrency(price), priceX, currentY + 7, { width: 70, align: 'right' })
      .text(formatCurrency(rowTotal), totalX, currentY + 7, { width: 65, align: 'right' });
    doc.moveTo(left, currentY + rowHeight).lineTo(right, currentY + rowHeight).lineWidth(0.6).strokeColor('#ececec').stroke();
    currentY += rowHeight;
  });
  doc.rect(left, tableTop, contentWidth, currentY - tableTop).lineWidth(1).strokeColor(lightBorder).stroke();

  const totalsTop = currentY + 24;
  const totalsX = right - 220;
  const totalsValueX = right - 110;
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#222222')
    .text('Subtotal', totalsX, totalsTop, { width: 110 })
    .text(formatCurrency(subtotal), totalsValueX, totalsTop, { width: 110, align: 'right' })
    .text(taxLabel, totalsX, totalsTop + 18, { width: 110 })
    .text(formatCurrency(taxAmount), totalsValueX, totalsTop + 18, { width: 110, align: 'right' });
  doc.moveTo(totalsX, totalsTop + 42).lineTo(right, totalsTop + 42).lineWidth(1).strokeColor(lightBorder).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(15)
    .fillColor(brandColor)
    .text('Grand Total', totalsX, totalsTop + 50, { width: 120 })
    .text(formatCurrency(finalTotal), right - 140, totalsTop + 48, { width: 140, align: 'right' });

  const footerY = Math.max(totalsTop + 118, 760);
  doc.moveTo(left, footerY - lineGap).lineTo(right, footerY - lineGap).lineWidth(1).strokeColor(lightBorder).stroke();
  doc
    .fillColor(brandColor)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Thank you for your order', left, footerY, { align: 'center', width: contentWidth });
  doc
    .fillColor(subtleText)
    .font('Helvetica')
    .fontSize(9)
    .text('For support: support@farmycure.com', left, footerY + 16, { align: 'center', width: contentWidth });
};

const generateInvoicePdfBuffer = async (order) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      renderInvoice(doc, order);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });

const streamInvoicePdfToResponse = async (order, res, fileName) => {
  const pdfBuffer = await generateInvoicePdfBuffer(order);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(pdfBuffer);
};

module.exports = {
  generateInvoicePdfBuffer,
  streamInvoicePdfToResponse,
};
