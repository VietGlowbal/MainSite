# VNPay Sandbox setup

Set these server-only environment variables in the deployment environment (do
not commit them):

```dotenv
VNPAY_TMN_CODE=<sandbox terminal id>
VNPAY_HASH_SECRET=<sandbox secret key>
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://<public-host>/payment/vnpay/return
VNPAY_IPN_URL=https://<public-host>/api/payments/vnpay/ipn
# Optional kill switch: VNPAY_ENABLED=false
```

Run `supabase-vnpay-payments.sql` after the mentorship and Plus migrations.
Register the public IPN URL in the VNPay Sandbox merchant console. The code
rejects non-Sandbox payment hosts and never exposes the hash secret to the
browser.

Payment fulfilment persists `notification_status=pending`; email delivery and
reconciliation retry processing remain an operational follow-up after Sandbox
SIT.
