import {NextResponse} from 'next/server'
import {pool} from '@/lib/db'

// force dynamic so it doesnt cache the result forever
export const dynamic = 'force-dynamic'

export async function GET(){
    try{
        // Fetch the single most recent log
        const [rows] = await pool.query(
            'SELECT * FROM logs ORDER BY id DESC LIMIT 1');

            // @ts-ignore
            const data = rows[0];

            return NextResponse.json(data || {
                vehicle_count: 0,
                congestion_status: 'Waiting for AI....'
            });
    }catch(error: any){
        return NextResponse.json({error: error.message}, {status: 500})
    }
}
