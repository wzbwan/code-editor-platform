import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Godot WebView 访问代码闯关已停用，请使用 Godot 原生客户端接口 /api/godot/challenges/login',
    },
    { status: 410 }
  )
}
