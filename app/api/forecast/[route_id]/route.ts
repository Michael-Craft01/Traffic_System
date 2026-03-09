import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ route_id: string }> }
) {
    const { route_id } = await params;
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

    try {
        const response = await fetch(`${backendUrl}/api/v1/routing/forecast/${route_id}`, { cache: 'no-store' });
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
