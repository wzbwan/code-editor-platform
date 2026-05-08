import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    { error: '代码闯关仅允许通过 Godot 原生客户端提交' },
    { status: 403 }
  )
}
