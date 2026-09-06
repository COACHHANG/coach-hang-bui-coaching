import { getAppConfig, getQrUrl, supabaseRequest } from './_shared.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const token = String(req.query.token || '');
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return res.status(400).json({ error: 'Mã đơn không hợp lệ.' });

  try {
    const { accountNumber, bankCode } = getAppConfig();
    const orders = await supabaseRequest(`orders?public_token=eq.${encodeURIComponent(token)}&select=reference,amount_vnd,status,paid_at`);
    const order = orders[0];
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn thanh toán.' });

    return res.status(200).json({
      reference: order.reference,
      amount: order.amount_vnd,
      status: order.status,
      paidAt: order.paid_at,
      qrUrl: getQrUrl({ accountNumber, bankCode, amount: order.amount_vnd, reference: order.reference }),
    });
  } catch (error) {
    console.error('get order status failed', error);
    return res.status(500).json({ error: 'Chưa thể kiểm tra trạng thái thanh toán.' });
  }
}
