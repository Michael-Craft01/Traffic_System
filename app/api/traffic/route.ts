import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Forces Next.js to not cache this

export async function GET() {
  try {
    console.log("⚡ API Request received...");
    
    // Test the connection
    const [rows]: any = await pool.query(
      'SELECT * FROM traffic_logs ORDER BY id DESC LIMIT 1'
    );
    
    console.log("✅ API Database Read Success:", rows[0]);

    // Handle empty database case
    const data = rows[0] || { 
      vehicle_count: 0, 
      congestion_status: "Waiting for data..." 
    };

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("❌ API ERROR:", error.message); // This will show in your terminal
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}