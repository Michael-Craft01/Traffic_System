import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(
    request: Request,
    { params }: { params: { route_id: string } }
) {
    const routeID = params.route_id;
    try {
        const res = await fetch(`${BACKEND_URL}/api/v1/routing/forecast/${routeID}`, { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
