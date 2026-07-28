/** Safe JSON parse for fetch responses (avoids empty-body SyntaxError). */
export async function readJson<T = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error(
      `Пустой ответ API (${res.status}). Откройте /api/health и выполните: npx prisma generate && npx prisma migrate dev`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Ответ не JSON (${res.status}): ${text.slice(0, 180)}`
    );
  }
}
