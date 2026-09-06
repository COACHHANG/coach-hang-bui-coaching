import { PRICE_VND, PRODUCT_NAME, createPublicToken, createReference, getAppConfig, getQrUrl, supabaseRequest } from './_shared.mjs';

function clean(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const customerName = clean(body.customerName, 120);
    const email = clean(body.email, 160).toLowerCase();
    const phone = clean(body.phone, 30);
    const context = clean(body.context, 1200);

    if (customerName.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || phone.length < 8) {
      return res.status(400).json({ error: 'Vui lòng điền họ tên, email và số điện thoại hợp lệ.' });
    }

    const { accountNumber, bankCode, paymentPrefix } = getAppConfig();
    const reference = createReference(paymentPrefix);
    const publicToken = createPublicToken();
    const [order] = await supabaseRequest('orders', {
      method: 'POST',
      body: JSON.stringify({
        reference,
        public_token: publicToken,
        customer_name: customerName,
        customer_email: email,
        customer_phone: phone,
        coaching_context: context || null,
        product_name: PRODUCT_NAME,
        amount_vnd: PRICE_VND,
        status: 'pending',
      }),
    });

    return res.status(201).json({
      token: order.public_token,
      reference: order.reference,
      amount: order.amount_vnd,
      qrUrl: getQrUrl({ accountNumber, bankCode, amount: order.amount_vnd, reference: order.reference }),
    });
  } catch (error) {
    console.error('create order failed', error);
    return res.status(500).json({ error: 'Chưa thể tạo đơn thanh toán. Vui lòng thử lại sau.' });
  }
}
