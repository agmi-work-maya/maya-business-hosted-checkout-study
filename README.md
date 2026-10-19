# Maya Create Checkout demo

Express server + static HTML client calling Maya's
[Create Checkout](https://developers.maya.ph/reference/createv1checkout) endpoint (`POST /checkout/v1/checkouts`).

## Run
```
npm install
cp .env.example .env   # add your sandbox public + secret keys
npm start              # http://localhost:3000
```

## Flow
1. Browser POSTs `/api/checkouts` → server calls Maya with the public key (Basic auth).
2. Server returns Maya's `redirectUrl`; the browser redirects to Maya's hosted checkout.
3. Customer returns to `/result.html`, which asks the server (`GET /api/checkouts/:ref`) for the authoritative status (uses the secret key).
4. Maya webhooks hit `POST /webhooks/maya`; expose locally with a tunnel such as ngrok.

Note: the docs site was unreachable from the build environment, so the payload was written from
search snippets and prior knowledge (`totalAmount`, `buyer`, `items`, `redirectUrl`,
`requestReferenceNumber`; response `checkoutId` / `redirectUrl`). Verify field names, the
status-lookup response shape (`paymentStatus`), and webhook payload against the reference.
