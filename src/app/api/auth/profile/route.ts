import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { language, name, avatar } = await request.json();

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        ...(language && { language }),
        ...(name && { name }),
        ...(avatar && { avatar }),
      },
      select: { id: true, name: true, email: true, language: true, avatar: true, createdAt: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
