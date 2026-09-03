import { getScoreboardSnapshot } from "@/lib/production/scoreboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sector = searchParams.get("sector") ?? "colagem";

  try {
    const scoreboard = await getScoreboardSnapshot(sector);

    if (!scoreboard) {
      return Response.json(
        {
          status: "not_found",
          message: "Placar nao encontrado para o setor informado.",
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return Response.json(scoreboard, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("scoreboard fetch failed", error);

    return Response.json(
      {
        status: "server_error",
        message: "Falha ao carregar placar.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
