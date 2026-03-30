export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // TODO: call external API
  // const data = await fetch(process.env.EXTERNAL_API_URL!).then(r => r.json());

  // TODO: store response
  // await storeData(data);

  return Response.json({ ok: true, timestamp: new Date().toISOString() });
}
