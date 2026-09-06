import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { PRICE_VND, PRODUCT_NAME, getAppConfig, readRawBody, supabaseRequest, timingSafeEqual } from './_shared.mjs';

export const config = { api: { bodyParser: false } };

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getReference(payload, prefix) {
  const source = `${payload.code || ''} ${payload.content || ''}`.toUpperCase();
  const pattern = new RegExp(`\\b${escapeRegExp(prefix.toUpperCase())}-[A-F0-9]{8}\\b`);
  return source.match(pattern)?.[0] || null;
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + 'đ';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]);
}

async function sendEmails(order, payload) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  const ownerEmail = process.env.OWNER_EMAIL || 'coach.hangbui@gmail.com';
  if (!gmailUser || !gmailPassword) {
    console.warn('Email chưa được cấu hình; bỏ qua gửi email cho đơn', order.reference);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPassword },
  });
  const paidAt = payload.transactionDate || new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const amount = formatMoney(order.amount_vnd);
  const ownerHtml = `<h2>Đã thanh toán coaching</h2>
    <p><strong>Khách:</strong> ${escapeHtml(order.customer_name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(order.customer_email)}<br><strong>Điện thoại:</strong> ${escapeHtml(order.customer_phone)}</p>
    <p><strong>Dịch vụ:</strong> ${escapeHtml(order.product_name)}<br><strong>Số tiền:</strong> ${amount}<br><strong>Mã đơn:</strong> ${escapeHtml(order.reference)}</p>
    <p><strong>Ngân hàng:</strong> ${payload.gateway || 'MB Bank'}<br><strong>Mã giao dịch:</strong> ${payload.referenceCode || payload.id}<br><strong>Thời gian:</strong> ${paidAt}</p>`;
  const clientHtml = `<h2>Coach Hằng Bùi đã nhận thanh toán</h2>
    <p>Chào ${escapeHtml(order.customer_name)},</p>
    <p>Coach Hằng đã nhận được thanh toán cho <strong>${order.product_name}</strong>.</p>
    <p><strong>Số tiền:</strong> ${amount}<br><strong>Mã đơn:</strong> ${order.reference}</p>
    <p>Coach Hằng sẽ liên hệ với bạn để xác nhận thời gian phù hợp cho phiên coaching online.</p>
    <p>Trân trọng,<br>Coach Hằng Bùi</p>`;

  await Promise.all([
    transporter.sendMail({ from: `Coach Hằng Bùi <${gmailUser}>`, to: ownerEmail, subject: `[Đã thanh toán] ${order.customer_name} · ${amount}`, html: ownerHtml }),
    transporter.sendMail({ from: `Coach Hằng Bùi <${gmailUser}>`, to: order.customer_email, subject: `Xác nhận thanh toán · ${PRODUCT_NAME}`, html: clientHtml }),
  ]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  try {
    const rawBody = await readRawBody(req);
    const timestamp = String(req.headers['x-sepay-timestamp'] || '');
    const signature = String(req.headers['x-sepay-signature'] || '');
    const secret = process.env.SEPAY_WEBHOOK_SECRET;
    if (!secret || !timestamp || !signature) return res.status(401).json({ success: false });

    const expected = `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex')}`;
    if (!timingSafeEqual(signature, expected)) return res.status(401).json({ success: false });
    if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return res.status(401).json({ success: false });

    const payload = JSON.parse(rawBody.toString('utf8'));
    const { accountNumber, paymentPrefix } = getAppConfig();
    const reference = getReference(payload, paymentPrefix);
    if (!reference || String(payload.transferType || '').toLowerCase() !== 'in' || String(payload.accountNumber || '') !== accountNumber) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const orders = await supabaseRequest(`orders?reference=eq.${encodeURIComponent(reference)}&select=*`);
    const order = orders[0];
    if (!order || Number(payload.transferAmount) !== Number(order.amount_vnd || PRICE_VND)) {
      return res.status(200).json({ success: true, ignored: true });
    }
    if (order.status === 'paid') return res.status(200).json({ success: true, duplicate: true });

    const [updatedOrder] = await supabaseRequest(`orders?reference=eq.${encodeURIComponent(reference)}&status=eq.pending`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'paid',
        payment_transaction_id: String(payload.id || payload.referenceCode || ''),
        payment_reference_code: String(payload.referenceCode || ''),
        payment_gateway: String(payload.gateway || ''),
        paid_at: new Date().toISOString(),
      }),
    });

    if (updatedOrder) {
      try {
        await sendEmails(updatedOrder, payload);
        await supabaseRequest(`orders?reference=eq.${encodeURIComponent(reference)}`, {
          method: 'PATCH',
          body: JSON.stringify({ owner_email_sent_at: new Date().toISOString(), customer_email_sent_at: new Date().toISOString() }),
        });
      } catch (emailError) {
        console.error('payment confirmed but email failed', emailError);
      }
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('SePay webhook failed', error);
    return res.status(500).json({ success: false });
  }
}
