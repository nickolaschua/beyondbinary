This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, make sure the backend is running (see backend/README.md):

```bash
# In the backend directory
cd backend
source venv/bin/activate
./run_dev.sh
```

Then run the frontend development server:

```bash
npm run dev
```

**Access URLs:**
- Local: http://localhost:3000
- Network: http://10.91.174.93:3000

Open with your browser to see the result. Use the network URL to access from other devices on the same network.

### Video call on two devices (ngrok)

Camera/mic require HTTPS. To test the video call on two devices (e.g. phone + laptop):

1. Start the app: `npm run dev`
2. In another terminal, start the tunnel: `npm run tunnel`
3. Copy the **HTTPS** URL ngrok prints (e.g. `https://abc123.ngrok-free.app`) and open it on both devices. Accept the browser certificate if prompted.

If the second device can’t reach your backend (API/WebSockets on port 8000), either:

- Run a second ngrok tunnel for the backend: `ngrok http 8000`, then start the frontend with:
  - `NEXT_PUBLIC_API_URL=https://YOUR_BACKEND_NGROK_URL NEXT_PUBLIC_WS_URL=wss://YOUR_BACKEND_NGROK_HOST npm run dev`  
  (use the same ngrok host for both; replace `https` with `wss` for the WebSocket URL), or  
- Use your machine’s LAN IP for the backend (both devices on same Wi‑Fi):  
  `NEXT_PUBLIC_API_URL=http://YOUR_LAN_IP:8000 NEXT_PUBLIC_WS_URL=ws://YOUR_LAN_IP:8000 npm run dev`, then use the frontend ngrok HTTPS URL on both devices.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
