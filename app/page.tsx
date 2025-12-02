"use client";
import {useState, useEffect} from 'react'

export default function Home(){
  const [data, setData] = useState({
    vehicle_count: 0,
    congestion_status: "loading..."
  })

  // poll the api every 2 sec
  useEffect(()=>{
    const interval = setInterval(async()=>{
      try{
        const res = await fetch('/api/traffic', {cache: 'no-store'})
        const json = await res.json();
        if(json.vehicle_count !== undefined){
          setData(json);
        }

      }catch(err){
        console.error("Failed to fetch data, error: ", err);
      }
    }, 2000) //2000,ms = 2sec

    return () => clearInterval(interval);
  }, []);

  // dynamic color logic
  const getStatusColor = (status: string)=>{
    if (status=== 'CONGESTED') return 'bg-red-600 border-red-600';
    if (status === 'MODERATE') return 'bg-orange-600 border-orange-600';
    // if (status === 'CLEAR') return 'bg-green-600 border-green-600';
    return 'bg-green-600 border-green-600';
  };
  return(
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      
      {/* HEADER */}
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-2">
          🚦 Traffic Command Center
        </h1>
        <p className="text-slate-400">Harare CBD • Real-Time AI Monitoring</p>
      </div>

      {/* DASHBOARD CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        
        {/* CARD 1: VEHICLE COUNT */}
        <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl flex flex-col items-center justify-center">
          <h2 className="text-slate-400 font-medium uppercase tracking-wider mb-4">
            Detected Vehicles
          </h2>
          <div className="text-8xl font-black text-blue-400">
            {data.vehicle_count}
          </div>
          <p className="text-sm text-slate-500 mt-4">Updated Live</p>
        </div>

        {/* CARD 2: STATUS ALERT */}
        <div className={`rounded-3xl p-8 border-4 shadow-2xl flex flex-col items-center justify-center transition-colors duration-500 ${getStatusColor(data.congestion_status)}`}>
          <h2 className="text-white/80 font-medium uppercase tracking-wider mb-4">
            Current Status
          </h2>
          <div className="text-5xl md:text-6xl font-black text-white text-center leading-tight">
            {data.congestion_status}
          </div>
          <p className="text-sm text-white/60 mt-4">AI Recommendation</p>
        </div>

      </div>

      {/* FOOTER */}
      <div className="mt-12 text-slate-500 text-sm">
        System Node: CAM_01 • Latency: &lt;100ms
      </div>

    </main>
  );
}